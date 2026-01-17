import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { aiConfig } from '../../config/ai.config';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  private readonly aiConfig = aiConfig();
  private openai: OpenAI;

  constructor(private readonly metricsService: MetricsService) {
    this.openai = new OpenAI({
      apiKey: this.aiConfig.openaiApiKey,
    });

    this.logger.log(
      `OpenAI Vision API initialized (model: ${this.aiConfig.openaiModel}, temperature: ${this.aiConfig.openaiTemperature})`,
    );
  }

  /**
   * Extract text from an image using OpenAI Vision API
   * Handles vertically stacked labels/values by preserving spatial relationships
   */
  async extractTextFromImage(buffer: Buffer, filename: string): Promise<string> {
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
        model: this.aiConfig.openaiModel,
        temperature: this.aiConfig.openaiTemperature,
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
          this.aiConfig.openaiModel,
          duration,
          'error',
        );
        return '';
      }

      const duration = (Date.now() - start) / 1000;
      this.metricsService.recordAICall(
        'image-ocr',
        this.aiConfig.openaiModel,
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
        this.aiConfig.openaiModel,
        duration,
        'error',
      );
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.logger.error(
        `Image processing failed for ${filename}: ${errorMessage} (type: ${errorType})`,
      );
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
