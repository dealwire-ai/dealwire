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
  internetMessageId?: string;
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
        `${GRAPH_BASE_URL}/me/messages/${messageId}?$select=id,subject,from,toRecipients,body,receivedDateTime,hasAttachments,conversationId,internetMessageId`,
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
   * Creates a reply draft, changes recipient to self, CCs admins, then sends
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
      const draftSubject = draft.subject || '';
      const draftConversationId = draft.conversationId;

      // Fetch original message to get internetMessageId for verification/logging
      const originalMessage = await this.getMessage(accessToken, messageId);
      const originalInternetMessageId = originalMessage?.internetMessageId;

      // Step 2: Update the draft - change recipients to self, CC admins, set body, and preserve threading properties
      // Preserving subject and conversationId is critical for threading in older Outlook versions
      // Note: In-Reply-To and References headers are automatically set by createReply and should be preserved by PATCH
      const updateBody: any = {
        subject: draftSubject, // Preserve subject from createReply (includes "Re: " prefix)
        toRecipients: [
          { emailAddress: { address: userEmail } },
        ],
        ccRecipients: ADMIN_CC_EMAILS.map((email) => ({
          emailAddress: { address: email },
        })),
        body: {
          contentType: 'html',
          content: htmlBody,
        },
      };

      // Preserve conversationId if available (helps with threading in older Outlook)
      if (draftConversationId) {
        updateBody.conversationId = draftConversationId;
      }

      const updateResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${draftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateBody),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        this.logger.error(`Failed to update reply draft: ${updateResponse.status} - ${errorText}`);
        return false;
      }

      // Log threading properties for debugging threading issues
      this.logger.debug(
        `Reply draft updated with subject: "${draftSubject}", conversationId: ${draftConversationId || 'N/A'}, original Message-ID: ${originalInternetMessageId || 'N/A'}`,
      );

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

      this.logger.log(`Reply-to-self sent via Graph for message ${messageId} (CC'd admins)`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending reply-to-self for ${messageId}: ${msg}`);
      return false;
    }
  }

  /**
   * Send the original email content to admins as a reply in the conversation thread
   * This ensures everything appears in one thread for admins (original + our reply)
   */
  async forwardToAdmins(
    accessToken: string,
    messageId: string,
  ): Promise<boolean> {
    try {
      // Get the original message to include its content
      const originalMessage = await this.getMessage(accessToken, messageId);
      if (!originalMessage) {
        this.logger.error(`Failed to fetch original message ${messageId} for forward`);
        return false;
      }

      // Extract original message content
      const originalBody = originalMessage.body?.content || '';
      const originalSubject = originalMessage.subject || 'No subject';
      const originalFrom = originalMessage.from?.emailAddress?.address || 'Unknown';
      const originalFromName = originalMessage.from?.emailAddress?.name || originalFrom;
      const receivedDate = new Date(originalMessage.receivedDateTime).toLocaleString();

      // Construct body with original message content
      const forwardBody = `
        <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
        <p>Forwarded message for Admin visibility.</p>
        <div style="font-family: Arial, sans-serif;">
          <p><strong>From:</strong> ${originalFromName} &lt;${originalFrom}&gt;</p>
          <p><strong>Subject:</strong> ${originalSubject}</p>
          <p><strong>Date:</strong> ${receivedDate}</p>
          <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
          <div style="white-space: pre-wrap;">${originalBody}</div>
        </div>
      `;

      // Create a reply in the same conversation thread (not a forward)
      // This ensures it appears in the same thread as our analysis reply
      const createReplyResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${messageId}/createReply`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!createReplyResponse.ok) {
        const errorText = await createReplyResponse.text();
        this.logger.error(`Failed to create reply draft for forward: ${createReplyResponse.status} - ${errorText}`);
        return false;
      }

      const draft = await createReplyResponse.json();
      const draftId = draft.id;
      const draftSubject = draft.subject || '';

      // Update the draft - change recipients to admins, set body with original content, and preserve subject
      // Preserving the subject is critical for threading in older Outlook versions
      const updateResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages/${draftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: draftSubject, // Preserve subject from createReply (includes "Re: " prefix)
            toRecipients: ADMIN_CC_EMAILS.map((email) => ({
              emailAddress: { address: email },
            })),
            body: {
              contentType: 'html',
              content: forwardBody,
            },
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        this.logger.error(`Failed to update reply draft: ${updateResponse.status} - ${errorText}`);
        return false;
      }

      // Add attachments from the original message to the forward
      if (originalMessage.hasAttachments) {
        const attachments = await this.getAttachments(accessToken, messageId);
        for (const attachment of attachments) {
          try {
            // Download attachment content
            const attachmentContent = await this.getAttachmentContent(
              accessToken,
              messageId,
              attachment.id,
            );

            if (!attachmentContent) {
              this.logger.warn(`Failed to download attachment ${attachment.name}, skipping`);
              continue;
            }

            // Add attachment to draft
            const addAttachmentResponse = await fetch(
              `${GRAPH_BASE_URL}/me/messages/${draftId}/attachments`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  '@odata.type': '#microsoft.graph.fileAttachment',
                  name: attachment.name,
                  contentType: attachment.contentType,
                  contentBytes: attachmentContent.toString('base64'),
                }),
              },
            );

            if (!addAttachmentResponse.ok) {
              const errorText = await addAttachmentResponse.text();
              this.logger.warn(`Failed to add attachment ${attachment.name}: ${addAttachmentResponse.status} - ${errorText}`);
            } else {
              this.logger.log(`Added attachment ${attachment.name} to forward`);
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Error adding attachment ${attachment.name}: ${msg}`);
          }
        }
      }

      // Send the reply (which will be in the same conversation thread)
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
      // Wait for Graph API to index the replies we just sent
      // Note: This is called after an 8s wait in email-processor, but we add extra wait here for safety
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Find all messages in this conversation from multiple sources
      const allMessages: Array<{ id: string; parentFolderId: string; source: string }> = [];

      // Check Inbox folder
      const inboxResponse = await fetch(
        `${GRAPH_BASE_URL}/me/messages?$filter=conversationId eq '${conversationId}'&$select=id,parentFolderId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (inboxResponse.ok) {
        const inboxData = await inboxResponse.json();
        const inboxMessages = (inboxData.value || []).map((msg: { id: string; parentFolderId: string }) => ({
          ...msg,
          source: 'Inbox',
        }));
        allMessages.push(...inboxMessages);
        this.logger.debug(`Found ${inboxMessages.length} messages in Inbox for conversation ${conversationId}`);
      } else {
        this.logger.warn(`Failed to fetch Inbox messages: ${inboxResponse.status}`);
      }

      // Check Sent Items for the reply-to-self and forward messages
      const sentItemsResponse = await fetch(
        `${GRAPH_BASE_URL}/me/mailFolders('SentItems')/messages?$filter=conversationId eq '${conversationId}'&$select=id,parentFolderId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (sentItemsResponse.ok) {
        const sentData = await sentItemsResponse.json();
        const sentMessages = (sentData.value || []).map((msg: { id: string; parentFolderId: string }) => ({
          ...msg,
          source: 'SentItems',
        }));
        allMessages.push(...sentMessages);
        this.logger.debug(`Found ${sentMessages.length} messages in Sent Items for conversation ${conversationId}`);
      } else {
        this.logger.warn(`Failed to fetch Sent Items messages: ${sentItemsResponse.status}`);
      }

      // Also check the target folder to see if any messages are already there
      const targetFolderResponse = await fetch(
        `${GRAPH_BASE_URL}/me/mailFolders('${folderId}')/messages?$filter=conversationId eq '${conversationId}'&$select=id,parentFolderId`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (targetFolderResponse.ok) {
        const targetData = await targetFolderResponse.json();
        const targetMessages = (targetData.value || []).map((msg: { id: string; parentFolderId: string }) => ({
          ...msg,
          source: 'TargetFolder',
        }));
        allMessages.push(...targetMessages);
        this.logger.debug(`Found ${targetMessages.length} messages already in target folder for conversation ${conversationId}`);
      }

      // Deduplicate by message ID (reply appears in both Inbox and Sent Items)
      const uniqueMessages = Array.from(
        new Map(allMessages.map((msg) => [msg.id, msg])).values(),
      );

      this.logger.log(
        `Found ${uniqueMessages.length} unique messages in conversation ${conversationId} (sources: ${[...new Set(uniqueMessages.map(m => m.source))].join(', ')})`,
      );

      // Log each message found
      for (const msg of uniqueMessages) {
        this.logger.debug(`Message ${msg.id} in ${msg.source} (parentFolderId: ${msg.parentFolderId})`);
      }

      // Move each message that isn't already in the target folder
      let movedCount = 0;
      let skippedCount = 0;
      const movedMessageIds: string[] = [];
      const skippedMessageIds: string[] = [];

      for (const msg of uniqueMessages) {
        if (msg.parentFolderId === folderId) {
          skippedCount++;
          skippedMessageIds.push(msg.id);
          this.logger.debug(`Message ${msg.id} already in target folder (${msg.source}), skipping`);
        } else {
          // Retry logic with exponential backoff for messages that might not be indexed yet
          let success = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            success = await this.moveMessage(accessToken, msg.id, folderId);
            if (success) {
              movedCount++;
              movedMessageIds.push(msg.id);
              this.logger.log(`Moved message ${msg.id} from ${msg.source} to target folder (attempt ${attempt + 1})`);
              break;
            }

            // Exponential backoff: 2s, 4s, 8s delays
            if (attempt < 2) {
              const delayMs = 2000 * Math.pow(2, attempt);
              this.logger.debug(`Message ${msg.id} move failed, retrying in ${delayMs}ms (attempt ${attempt + 2}/3)`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }

          if (!success) {
            skippedCount++;
            skippedMessageIds.push(msg.id);
            this.logger.warn(`Failed to move message ${msg.id} from ${msg.source} after 3 attempts`);
          }
        }
      }

      this.logger.log(
        `Conversation move complete for ${conversationId}: ${movedCount} moved (${movedMessageIds.join(', ')}), ${skippedCount} skipped (${skippedMessageIds.join(', ')})`,
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

    // Always try to fetch attachments, even if hasAttachments is false
    // (hasAttachments can be unreliable, especially for inline images)
    const graphAttachments = await this.getAttachments(accessToken, messageId);
    this.logger.debug(
      `Message ${messageId} hasAttachments: ${message.hasAttachments}, fetched ${graphAttachments.length} attachments`,
    );

    for (const att of graphAttachments) {
      this.logger.debug(
        `Attachment: ${att.name} (${att.contentType}, ${att.size} bytes)`,
      );
      attachments.push({
        filename: att.name,
        contentType: att.contentType,
        size: att.size,
        contentId: att.id,
      });
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


