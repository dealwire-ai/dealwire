import {
  Controller,
  Post,
  Body,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { DemoAnalystService } from '../service/agent/demo-analyst.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import type { CoreMessage } from 'ai';

/**
 * Chat endpoint for internal demo pages. Deliberately NOT behind
 * RequireOrgGuard — demos are internal sales tools, not org-scoped data —
 * and deliberately not the DealwireAgentService (whose deal-screening
 * persona and NYC tools override the demo's analyst prompt).
 * Responds with a plain text stream (text/plain), not the AI SDK data
 * protocol, so demo pages can append chunks directly.
 */
@Controller('demo-chat')
@UseGuards(ClerkAuthGuard)
export class DemoChatController {
  constructor(private readonly analyst: DemoAnalystService) {}

  @Post()
  async chat(
    @Body() body: { system?: string; messages: CoreMessage[] },
    @Res() res: Response,
  ): Promise<void> {
    const { system, messages } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpException(
        'messages array is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!system || typeof system !== 'string') {
      throw new HttpException(
        'system prompt is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = this.analyst.stream(system, messages);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200);
    try {
      for await (const chunk of result.textStream) {
        res.write(chunk);
      }
    } catch (err) {
      // Headers are already sent — append the error so the demo fails loud
      // in rehearsal instead of silently truncating.
      const msg = err instanceof Error ? err.message : String(err);
      res.write(`\n\n[analyst error: ${msg}]`);
    } finally {
      res.end();
    }
  }
}
