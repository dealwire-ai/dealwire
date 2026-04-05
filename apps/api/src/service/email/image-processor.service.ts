import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { imageOcrModelName } from '../underwriting/model-config';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(private readonly metricsService: MetricsService) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
      maxRetries: 3,
    });
  }

  /**
   * Extract text from an image using OpenAI Vision API
   * Handles vertically stacked labels/values by preserving spatial relationships
   */
  async extractTextFromImage(
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    const start = Date.now();
    try {
      // Convert buffer to base64
      const base64 = buffer.toString('base64');

      // Detect image type from filename or default to png
      const imageType = this.detectImageType(filename) || 'png';
      const dataUrl = `data:image/${imageType};base64,${base64}`;

      const prompt =
        'Extract all text from this real estate deal image. Preserve relationships between labels and values, ' +
        'even if they are vertically stacked. Format as structured text with labels and values clearly associated. ' +
        'For example, if you see "Purchase Price" or "Asking Price" above or below a dollar amount, ' +
        'associate them together. Include all financial metrics, property details, addresses, and contact information.';

      const response = await this.openai.chat.completions.create({
        model: imageOcrModelName(),
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        user: 'image-ocr',
      });

      const extractedText = response.choices[0]?.message?.content || '';

      if (!extractedText) {
        this.logger.warn(`No text extracted from image: ${filename}`);
        const duration = (Date.now() - start) / 1000;
        this.metricsService.recordAICall(
          'image-ocr',
          imageOcrModelName(),
          duration,
          'error',
        );
        return '';
      }

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall(
        'image-ocr',
        imageOcrModelName(),
        duration,
        'success',
      );

      this.logger.log(
        `Extracted ${extractedText.length} characters from image: ${filename} (${duration.toFixed(2)}s)`,
      );

      return extractedText;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall(
        'image-ocr',
        imageOcrModelName(),
        duration,
        'error',
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorType =
        error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Image processing failed for ${filename}: ${errorMessage} (type: ${errorType})`,
      );
      return '';
    }
  }

  /**
   * Extract text from multiple images in a single Vision API call.
   * Provides cross-image context so the model can correlate info across pages/sections.
   */
  /**
   * Max images to process in a single multi-image call.
   * Each high-detail image can use 3000+ tokens — capping at 6 keeps token usage reasonable.
   */
  private static readonly MAX_MULTI_IMAGES = 6;

  async extractTextFromMultipleImages(
    images: Array<{ data: string; label: string }>,
  ): Promise<string> {
    if (images.length === 0) return '';
    // Cap images to limit token usage
    if (images.length > ImageProcessorService.MAX_MULTI_IMAGES) {
      this.logger.log(
        `Capping image OCR from ${images.length} to ${ImageProcessorService.MAX_MULTI_IMAGES} images to limit token usage`,
      );
      images = images.slice(0, ImageProcessorService.MAX_MULTI_IMAGES);
    }
    if (images.length === 1) {
      // For a single image, fall back to the standard method with a buffer
      const match = images[0].data.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) {
        return this.extractTextFromImage(
          Buffer.from(match[1], 'base64'),
          images[0].label,
        );
      }
    }

    const start = Date.now();
    try {
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        {
          type: 'text',
          text:
            `You are viewing ${images.length} images from a real estate deal email or teaser. ` +
            'Extract ALL text from every image. These images likely form a single deal presentation — ' +
            'correlate information across images (e.g., property name from one image with financials from another). ' +
            'Preserve relationships between labels and values. Include all financial metrics, property details, ' +
            'addresses, and contact information. Format as structured text.',
        },
      ];

      for (const img of images) {
        content.push({
          type: 'image_url',
          image_url: { url: img.data, detail: 'low' },
        });
      }

      const response = await this.openai.chat.completions.create({
        model: imageOcrModelName(),
        temperature: 0,
        messages: [{ role: 'user', content }],
        max_tokens: 4096,
        user: 'image-ocr-multi',
      });

      const extractedText = response.choices[0]?.message?.content || '';
      const duration = (Date.now() - start) / 1000;

      this.metricsService.recordAICall(
        'image-ocr-multi',
        imageOcrModelName(),
        duration,
        extractedText ? 'success' : 'error',
      );

      this.logger.log(
        `Extracted ${extractedText.length} chars from ${images.length} images (${duration.toFixed(2)}s)`,
      );

      return extractedText;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall(
        'image-ocr-multi',
        imageOcrModelName(),
        duration,
        'error',
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Multi-image processing failed: ${errorMessage}`);
      return '';
    }
  }

  /**
   * Detect image type from filename extension
   */
  private detectImageType(filename: string): string | null {
    const ext = filename.toLowerCase().split('.').pop();
    const imageTypes: Record<string, string> = {
      png: 'png',
      jpg: 'jpeg',
      jpeg: 'jpeg',
      gif: 'gif',
      webp: 'webp',
    };
    return imageTypes[ext || ''] || null;
  }
}
