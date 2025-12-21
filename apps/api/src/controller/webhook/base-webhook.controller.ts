import {
  HttpException,
  HttpStatus,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'svix';

export abstract class BaseWebhookController {
  protected abstract readonly logger: Logger;

  protected verifyWebhook(
    req: RawBodyRequest<Request>,
    body: any,
    svixId: string,
    svixTimestamp: string,
    svixSignature: string,
    secret: string,
  ): void {
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new HttpException('Missing webhook headers', HttpStatus.UNAUTHORIZED);
    }

    try {
      const wh = new Webhook(secret);
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(body));

      wh.verify(rawBody.toString(), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook verification failed: ${errorMessage}`);
      throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }
  }
}

