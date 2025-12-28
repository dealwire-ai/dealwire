import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { clerkConfig } from '../../config/clerk.config';
import {
  NormalizedEmailEvent,
  NormalizedEmailAttachment,
} from '../../dto/normalized-email-event.dto';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name?: string } };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  body: { content: string; contentType: 'text' | 'html' };
  receivedDateTime: string;
  hasAttachments: boolean;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string; // Base64 encoded for small attachments
}

@Injectable()
export class MicrosoftGraphService {
  private readonly logger = new Logger(MicrosoftGraphService.name);
  private readonly clerk = createClerkClient({
    secretKey: clerkConfig().clerkSecretKey,
  });

  /**
   * Get Microsoft OAuth access token for a user from Clerk
   */
  async getAccessToken(userId: string): Promise<string | null> {
    try {
      const tokens = await this.clerk.users.getUserOauthAccessToken(
        userId,
        'microsoft',
      );

      if (!tokens.data || tokens.data.length === 0) {
        this.logger.warn(`No Microsoft OAuth token found for user ${userId}`);
        return null;
      }

      return tokens.data[0].token;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get Microsoft token for ${userId}: ${msg}`);
      return null;
    }
  }

  /**
   * Fetch a specific email message from Microsoft Graph
   */
  async getMessage(
    accessToken: string,
    messageId: string,
  ): Promise<GraphMessage | null> {
    try {
      const response = await fetch(`${GRAPH_BASE_URL}/me/messages/${messageId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(
          `Failed to fetch message ${messageId}: ${response.status}`,
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching message ${messageId}: ${msg}`);
      return null;
    }
  }

  /**
   * Fetch attachments for a message
   */
  async getAttachments(
    accessToken: string,
    messageId: string,
  ): Promise<GraphAttachment[]> {
    try {
      const response = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/attachments`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Failed to fetch attachments for ${messageId}: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching attachments for ${messageId}: ${msg}`);
      return [];
    }
  }

  /**
   * Download a specific attachment's content
   */
  async getAttachmentContent(
    accessToken: string,
    messageId: string,
    attachmentId: string,
  ): Promise<Buffer | null> {
    try {
      const response = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/attachments/${attachmentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Failed to download attachment ${attachmentId}: ${response.status}`,
        );
        return null;
      }

      const data = await response.json();
      if (data.contentBytes) {
        return Buffer.from(data.contentBytes, 'base64');
      }

      return null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error downloading attachment ${attachmentId}: ${msg}`);
      return null;
    }
  }

  /**
   * Reply to a message using Microsoft Graph (stays in same thread)
   */
  async replyToMessage(
    accessToken: string,
    messageId: string,
    htmlBody: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/reply`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              body: {
                contentType: 'html',
                content: htmlBody,
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to reply to message ${messageId}: ${response.status} - ${errorText}`);
        return false;
      }

      this.logger.log(`Reply sent via Graph for message ${messageId}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error replying to message ${messageId}: ${msg}`);
      return false;
    }
  }

  /**
   * Convert a Microsoft Graph message to our NormalizedEmailEvent format
   */
  async toNormalizedEvent(
    userId: string,
    accessToken: string,
    messageId: string,
  ): Promise<NormalizedEmailEvent | null> {
    const message = await this.getMessage(accessToken, messageId);
    if (!message) return null;

    const attachments: NormalizedEmailAttachment[] = [];

    if (message.hasAttachments) {
      const graphAttachments = await this.getAttachments(accessToken, messageId);
      for (const att of graphAttachments) {
        attachments.push({
          filename: att.name,
          contentType: att.contentType,
          size: att.size,
          contentId: att.id,
        });
      }
    }

    return {
      source: 'microsoft',
      messageId: message.id,
      userId,
      from: message.from?.emailAddress?.address || '',
      to: message.toRecipients?.map((r) => r.emailAddress.address) || [],
      subject: message.subject || '',
      bodyHtml: message.body?.contentType === 'html' ? message.body.content : undefined,
      bodyText: message.body?.contentType === 'text' ? message.body.content : undefined,
      attachments,
      receivedAt: new Date(message.receivedDateTime),
      rawData: message,
    };
  }
}


