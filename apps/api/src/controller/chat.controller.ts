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
import { Readable } from 'stream';
import { AnalyzerAgentService } from '../service/agent/analyzer-agent.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';
import type { CoreMessage } from 'ai';

@Controller('chat')
@UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(private readonly agent: AnalyzerAgentService) {}

  @Post()
  async chat(
    @AuthUser('organizationId') organizationId: string | null,
    @AuthUser('userId') userId: string | null,
    @Body() body: { messages: CoreMessage[] },
    @Res() res: Response,
  ): Promise<void> {
    if (!organizationId || !userId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }
    const { messages } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpException('messages array is required', HttpStatus.BAD_REQUEST);
    }

    const streamResult = await this.agent.stream(
      { organizationId, userId },
      messages,
    );
    const response = streamResult.toDataStreamResponse();

    const headers = Object.fromEntries(response.headers.entries());
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    res.status(response.status || 200);

    if (!response.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(response.body as any);
    nodeStream.pipe(res);
  }
}
