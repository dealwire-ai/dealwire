import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { clerkConfig } from '../../config/clerk.config';
import {
  NormalizedEmailEvent,
  NormalizedEmailAttachment,
} from '../../dto/normalized-email-event.dto';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const ADMIN_CC_EMAILS = ['isaac@frontstep.ai', 'noah@frontstep.ai'];

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name?: string } };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  body: { content: string; contentType: 'text' | 'html' };
  receivedDateTime: string;
  hasAttachments: boolean;
  conversationId?: string;
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
   * @param userId - Clerk user ID
   * @param logLevel - Log level for missing token: 'warn' (default) for unexpected cases, 'debug' for expected cases (e.g., checking if user has connected)
   */
  async getMicrosoftOAuthTokenFromClerk(
    userId: string,
    logLevel: 'warn' | 'debug' = 'warn',
  ): Promise<string | null> {
    try {
      const tokens = await this.clerk.users.getUserOauthAccessToken(
        userId,
        'microsoft',
      );

      if (!tokens.data || tokens.data.length === 0) {
        if (logLevel === 'debug') {
          this.logger.debug(`No Microsoft OAuth token found for user ${userId}`);
        } else {
          this.logger.warn(`No Microsoft OAuth token found for user ${userId}`);
        }
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
      const response = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}?$select=id,subject,from,toRecipients,body,receivedDateTime,hasAttachments,conversationId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

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
   * Send a reply-to-self in the same thread (for deal analysis)
   * Creates a reply draft, changes recipient to self, then sends
   */
  async replyToSelf(
    accessToken: string,
    messageId: string,
    userEmail: string,
    htmlBody: string,
  ): Promise<boolean> {
    try {
      // Step 1: Create a reply draft
      const createResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/createReply`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        this.logger.error(`Failed to create reply draft: ${createResponse.status} - ${errorText}`);
        return false;
      }

      const draft = await createResponse.json();
      const draftId = draft.id;

      // Step 2: Update the draft - change recipients to self and set body
      const updateResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${draftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toRecipients: [
              { emailAddress: { address: userEmail } },
            ],
            body: {
              contentType: 'html',
              content: htmlBody,
            },
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        this.logger.error(`Failed to update reply draft: ${updateResponse.status} - ${errorText}`);
        return false;
      }

      // Step 3: Send the draft
      const sendResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${draftId}/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        this.logger.error(`Failed to send reply: ${sendResponse.status} - ${errorText}`);
        return false;
      }

      this.logger.log(`Reply-to-self sent via Graph for message ${messageId}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending reply-to-self for ${messageId}: ${msg}`);
      return false;
    }
  }

  /**
   * Forward the email conversation thread to admin emails
   * Waits for the reply to be indexed, then forwards the conversation so admins see both
   * the original email and the generated reply
   */
  async forwardToAdmins(
    accessToken: string,
    messageId: string,
  ): Promise<boolean> {
    try {
      // Wait for the reply we just sent to be indexed by Graph API
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get the original message to find the conversation ID
      const originalMessage = await this.getMessage(accessToken, messageId);
      if (!originalMessage?.conversationId) {
        this.logger.warn(`No conversation ID found for message ${messageId}, forwarding single message`);
        // Fallback: forward the single message
        return this.forwardSingleMessage(accessToken, messageId);
      }

      // Find all messages in the conversation (including the reply we just sent)
      const conversationResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages?$filter=conversationId eq '${originalMessage.conversationId}'&$orderby=receivedDateTime desc&$select=id,receivedDateTime,parentFolderId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!conversationResponse.ok) {
        const errorText = await conversationResponse.text();
        this.logger.error(`Failed to fetch conversation: ${conversationResponse.status} - ${errorText}`);
        // Fallback: forward the single message
        return this.forwardSingleMessage(accessToken, messageId);
      }

      const conversationData = await conversationResponse.json();
      const messages = conversationData.value || [];

      if (messages.length === 0) {
        this.logger.warn(`No messages found in conversation ${originalMessage.conversationId}`);
        return this.forwardSingleMessage(accessToken, messageId);
      }

      // Forward the most recent message in the conversation (should include thread context)
      // This will include both the original email and our reply
      const mostRecentMessageId = messages[0].id;
      this.logger.log(`Forwarding conversation thread (${messages.length} messages) to admins via message ${mostRecentMessageId}`);
      
      return this.forwardSingleMessage(accessToken, mostRecentMessageId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error forwarding conversation to admins: ${msg}`);
      // Fallback: try to forward the single message
      return this.forwardSingleMessage(accessToken, messageId);
    }
  }

  /**
   * Forward a single message to admin emails
   */
  private async forwardSingleMessage(
    accessToken: string,
    messageId: string,
  ): Promise<boolean> {
    try {
      // Step 1: Create a forward draft
      const createResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/createForward`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        this.logger.error(`Failed to create forward draft: ${createResponse.status} - ${errorText}`);
        return false;
      }

      const draft = await createResponse.json();
      const draftId = draft.id;

      // Step 2: Update the draft - set recipients to admins and add optional comment
      const updateResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${draftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toRecipients: ADMIN_CC_EMAILS.map((email) => ({
              emailAddress: { address: email },
            })),
            body: {
              contentType: 'html',
              content: '<p>Automated forward for admin visibility.</p>',
            },
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        this.logger.error(`Failed to update forward draft: ${updateResponse.status} - ${errorText}`);
        return false;
      }

      // Step 3: Send the forward
      const sendResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${draftId}/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        this.logger.error(`Failed to send forward: ${sendResponse.status} - ${errorText}`);
        return false;
      }

      this.logger.log(`Forward sent to admins via Graph for message ${messageId}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error forwarding message ${messageId} to admins: ${msg}`);
      return false;
    }
  }

  /**
   * Get or create a mail folder by name
   * Returns the folder ID
   */
  async getOrCreateFolder(
    accessToken: string,
    folderName: string,
  ): Promise<string | null> {
    try {
      // First, try to find the folder
      const searchResponse = await fetch(
        `${GRAPH_BASE_URL}/me/mailFolders?$filter=displayName eq '${encodeURIComponent(folderName)}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (searchResponse.ok) {
        const data = await searchResponse.json();
        if (data.value && data.value.length > 0) {
          this.logger.debug(`Found existing folder: ${folderName}`);
          return data.value[0].id;
        }
      }

      // Folder doesn't exist, create it
      const createResponse = await fetch(`${GRAPH_BASE_URL}/me/mailFolders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: folderName }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        this.logger.error(`Failed to create folder ${folderName}: ${createResponse.status} - ${errorText}`);
        return null;
      }

      const folder = await createResponse.json();
      this.logger.log(`Created folder: ${folderName} (${folder.id})`);
      return folder.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting/creating folder ${folderName}: ${msg}`);
      return null;
    }
  }

  /**
   * Move a message to a specific folder
   */
  async moveMessage(
    accessToken: string,
    messageId: string,
    folderId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/move`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ destinationId: folderId }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        // 404 means message doesn't exist - might already be moved, deleted, or not indexed yet
        if (response.status === 404) {
          this.logger.debug(
            `Message ${messageId} not found (may already be moved or not indexed yet)`,
          );
          return false; // Not an error, just skip it
        }
        this.logger.error(`Failed to move message ${messageId}: ${response.status} - ${errorText}`);
        return false;
      }

      // Verify the move by checking the returned message's parentFolderId
      const movedMessage = await response.json();
      if (movedMessage.parentFolderId !== folderId) {
        this.logger.warn(
          `Move may have failed: expected parentFolderId=${folderId}, got ${movedMessage.parentFolderId}`,
        );
        return false;
      }

      // Verify the original message is no longer in Inbox (Graph API move creates new message, old ID should 404)
      // Note: The /move endpoint returns a NEW message ID in the destination folder
      // The original message ID should no longer exist in the source folder
      const originalMessageCheck = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (originalMessageCheck.ok) {
        const original = await originalMessageCheck.json();
        if (original.parentFolderId !== folderId) {
          this.logger.warn(
            `Original message ${messageId} still exists in source folder (parentFolderId: ${original.parentFolderId})`,
          );
        }
      } else if (originalMessageCheck.status === 404) {
        // This is expected - original message ID no longer exists (moved successfully)
        this.logger.debug(`Original message ${messageId} no longer exists (moved successfully)`);
      }

      this.logger.log(
        `Moved message ${messageId} to folder ${folderId} (new message ID: ${movedMessage.id}, parentFolderId: ${movedMessage.parentFolderId})`,
      );
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error moving message ${messageId}: ${msg}`);
      return false;
    }
  }

  /**
   * Move a message to a "passed deals" folder (gets or creates folder first)
   */
  async moveMessageToPassedFolder(
    accessToken: string,
    messageId: string,
    folderName: string,
  ): Promise<boolean> {
    const folderId = await this.getOrCreateFolder(accessToken, folderName);
    if (!folderId) {
      return false;
    }

    // Get the conversation ID to move all messages in the thread
    const message = await this.getMessage(accessToken, messageId);
    if (!message?.conversationId) {
      // Fallback: just move the single message
      return this.moveMessage(accessToken, messageId, folderId);
    }

    // Move all messages in the conversation
    return this.moveConversation(accessToken, message.conversationId, folderId);
  }

  /**
   * Move all messages in a conversation to a folder
   * Includes retry logic to handle Graph API indexing delays
   */
  async moveConversation(
    accessToken: string,
    conversationId: string,
    folderId: string,
  ): Promise<boolean> {
    try {
      // Wait a bit for Graph API to index the reply we just sent
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Find all messages in this conversation from Inbox
      const inboxResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages?$filter=conversationId eq '${conversationId}'&$select=id,parentFolderId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Also check Sent Items for the reply message
      const sentItemsResponse = await fetch(
        `${GRAPH_BASE_URL}/me/mailFolders('SentItems')/messages?$filter=conversationId eq '${conversationId}'&$select=id,parentFolderId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const allMessages: Array<{ id: string; parentFolderId: string }> = [];

      if (inboxResponse.ok) {
        const inboxData = await inboxResponse.json();
        allMessages.push(...(inboxData.value || []));
      }

      if (sentItemsResponse.ok) {
        const sentData = await sentItemsResponse.json();
        allMessages.push(...(sentData.value || []));
      }

      // Deduplicate by message ID (reply appears in both Inbox and Sent Items)
      const uniqueMessages = Array.from(
        new Map(allMessages.map((msg) => [msg.id, msg])).values(),
      );

      this.logger.log(`Found ${uniqueMessages.length} messages in conversation ${conversationId}`);

      // Move each message that isn't already in the target folder
      let movedCount = 0;
      let skippedCount = 0;
      for (const msg of uniqueMessages) {
        if (msg.parentFolderId === folderId) {
          skippedCount++;
          this.logger.debug(`Message ${msg.id} already in target folder, skipping`);
        } else {
          // Retry logic for messages that might not be indexed yet
          let success = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            success = await this.moveMessage(accessToken, msg.id, folderId);
            if (success) break;

            // If 404 and not last attempt, wait and retry
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          }

          if (success) {
            movedCount++;
          } else {
            skippedCount++;
          }
        }
      }

      this.logger.log(
        `Conversation move complete: ${movedCount} moved, ${skippedCount} skipped (already in folder or not found)`,
      );
      return movedCount > 0; // Success if we moved at least one message
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error moving conversation ${conversationId}: ${msg}`);
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


