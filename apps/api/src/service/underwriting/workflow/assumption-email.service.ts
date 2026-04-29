import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EmailSenderService } from '../../email/email-sender.service';
import { PrismaService } from '../../prisma/prisma.service';
import { emailConfig } from '../../../config/email.config';
import { AssumptionQuestion, ParsedAssumptions } from './assumption-types';
import { buildThreadSubject } from './thread-subject';

const MESSAGE_ID_DOMAIN = 'mail.dealwire.ai';

@Injectable()
export class AssumptionEmailService {
  private readonly logger = new Logger(AssumptionEmailService.name);
  private readonly config = emailConfig();

  constructor(
    private readonly emailSender: EmailSenderService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Send the initial assumption-questions email for a new underwriting run.
   * Returns the deterministic Message-ID so callers can persist it on the run.
   */
  async sendQuestionsEmail(params: {
    runId: string;
    senderEmail: string;
    questions: AssumptionQuestion[];
    inReplyToMessageId?: string;
    subject: string;
  }): Promise<{ messageId: string }> {
    const messageId = buildMessageId(params.runId, 'ask');
    const html = this.buildQuestionsHtml(params.questions, params.runId);
    const text = this.buildQuestionsText(params.questions);
    const bodyText = text;

    const ccAddresses = this.config.adminEmails.filter(
      (addr) => addr.toLowerCase() !== params.senderEmail.toLowerCase(),
    );

    await this.emailSender.sendEmail({
      to: [params.senderEmail],
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      subject: params.subject,
      html,
      text,
      from: this.config.underwritingInboundEmail
        ? `Dealwire <${this.config.underwritingInboundEmail}>`
        : undefined,
      replyToMessageId: params.inReplyToMessageId,
      messageId,
    });

    await this.prisma.underwritingRunMessage.create({
      data: {
        runId: params.runId,
        messageId,
        direction: 'OUTBOUND',
        phase: 'ASK',
        bodyText,
      },
    });

    this.logger.log(
      `[${params.runId}] Assumption ask email sent to ${params.senderEmail} (msgId=${messageId})`,
    );

    return { messageId };
  }

  /**
   * Send a clarification email when the investor's reply had unparseable fields.
   * The thread continues from the original ask so replies correlate back.
   */
  async sendClarificationEmail(params: {
    runId: string;
    senderEmail: string;
    unparseable: ParsedAssumptions['unparseable'];
    inReplyToMessageId?: string;
    property: string | null | undefined;
    rootRunId: string;
    references?: string[];
  }): Promise<{ messageId: string }> {
    const messageId = buildMessageId(params.runId, 'clarify');
    const html = this.buildClarificationHtml(params.unparseable);
    const text = this.buildClarificationText(params.unparseable);

    const ccAddresses = this.config.adminEmails.filter(
      (addr) => addr.toLowerCase() !== params.senderEmail.toLowerCase(),
    );

    const subject = buildThreadSubject(params.property, params.rootRunId, true);

    await this.emailSender.sendEmail({
      to: [params.senderEmail],
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      subject,
      html,
      text,
      from: this.config.underwritingInboundEmail
        ? `Dealwire <${this.config.underwritingInboundEmail}>`
        : undefined,
      replyToMessageId: params.inReplyToMessageId,
      references: params.references,
      messageId,
    });

    await this.prisma.underwritingRunMessage.create({
      data: {
        runId: params.runId,
        messageId,
        direction: 'OUTBOUND',
        phase: 'CLARIFY',
        bodyText: text,
      },
    });

    this.logger.log(
      `[${params.runId}] Clarification email sent to ${params.senderEmail} (msgId=${messageId})`,
    );

    return { messageId };
  }

  /**
   * Send a conversational answer in-thread (no proforma fill).
   * Used when the router classifies the reply as "answer" (e.g. the user
   * asks a question or makes a comment instead of supplying assumptions).
   */
  async sendAnswerEmail(params: {
    runId: string;
    senderEmail: string;
    answer: string;
    inReplyToMessageId?: string;
    property: string | null | undefined;
    rootRunId: string;
    references?: string[];
  }): Promise<{ messageId: string }> {
    const messageId = buildMessageId(params.runId, 'answer');
    const html = this.buildAnswerHtml(params.answer);
    const text = this.buildAnswerText(params.answer);

    const ccAddresses = this.config.adminEmails.filter(
      (addr) => addr.toLowerCase() !== params.senderEmail.toLowerCase(),
    );

    const subject = buildThreadSubject(params.property, params.rootRunId, true);

    await this.emailSender.sendEmail({
      to: [params.senderEmail],
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      subject,
      html,
      text,
      from: this.config.underwritingInboundEmail
        ? `Dealwire <${this.config.underwritingInboundEmail}>`
        : undefined,
      replyToMessageId: params.inReplyToMessageId,
      references: params.references,
      messageId,
    });

    await this.prisma.underwritingRunMessage.create({
      data: {
        runId: params.runId,
        messageId,
        direction: 'OUTBOUND',
        phase: 'ANSWER',
        bodyText: params.answer,
      },
    });

    this.logger.log(
      `[${params.runId}] Answer email sent to ${params.senderEmail} (msgId=${messageId})`,
    );

    return { messageId };
  }

  private buildAnswerHtml(answer: string): string {
    const escaped = escapeHtml(answer).replace(/\n/g, '<br>');
    return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;line-height:1.6;">
  <div style="font-size:14px;">${escaped}</div>
  <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Reply with new values like "drop rate to 5.5%" any time and I'll re-run the pro forma.</p>
</body>
</html>`;
  }

  private buildAnswerText(answer: string): string {
    return `${answer}\n\nReply with new values any time and I'll re-run the pro forma.`;
  }

  private buildQuestionsHtml(
    questions: AssumptionQuestion[],
    runId: string,
  ): string {
    const items = questions
      .map((q, idx) => {
        const chipColor = q.priority === 'required' ? '#dc2626' : '#6b7280';
        const chipText = q.priority === 'required' ? 'Required' : 'Recommended';
        const hintHtml = q.hint
          ? `<div style="color:#6b7280;font-size:13px;font-style:italic;margin-top:2px;">${escapeHtml(q.hint)}</div>`
          : '';
        return `
        <li style="margin-bottom:14px;">
          <div>
            <strong>${escapeHtml(q.question)}</strong>
            <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:10px;background:${chipColor};color:#fff;font-size:11px;font-weight:600;vertical-align:middle;">${chipText}</span>
          </div>
          ${hintHtml}
        </li>`;
      })
      .join('');

    return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;">
  <h2 style="border-bottom:2px solid #2563eb;padding-bottom:8px;">Before we run your pro forma</h2>
  <p>We've parsed the deal documents. To run a meaningful pro forma we need your underwriting assumptions. Reply to this email inline with your numbers — we'll run the model and send back a filled template.</p>
  <ol style="padding-left:20px;">${items}</ol>
  <p style="margin-top:24px;color:#6b7280;font-size:13px;">Reply with "what if rate drops to 5.5%" once you have the model back — we'll re-run with updated assumptions and carry everything else forward.</p>
  <p style="margin-top:8px;color:#9ca3af;font-size:11px;">Ref: UW-${shortRun(runId)}</p>
</body>
</html>`;
  }

  private buildQuestionsText(questions: AssumptionQuestion[]): string {
    const lines = questions.map((q, idx) => {
      const tag = q.priority === 'required' ? '(Required)' : '(Recommended)';
      const hint = q.hint ? `\n   ${q.hint}` : '';
      return `${idx + 1}. ${q.question} ${tag}${hint}`;
    });
    return `Before we run your pro forma, we need your underwriting assumptions. Reply inline with values.\n\n${lines.join('\n\n')}`;
  }

  private buildClarificationHtml(
    unparseable: ParsedAssumptions['unparseable'],
  ): string {
    const items = unparseable
      .map(
        (u) => `
        <li style="margin-bottom:12px;">
          <strong>${escapeHtml(u.key)}</strong>: we couldn't interpret "${escapeHtml(u.raw)}"<br>
          <span style="color:#6b7280;font-size:13px;">${escapeHtml(u.reason)}</span>
        </li>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;">
  <h2 style="border-bottom:2px solid #b45309;padding-bottom:8px;">A few assumptions need clarification</h2>
  <p>Thanks for the reply. We couldn't confidently parse the following — could you restate them?</p>
  <ul style="padding-left:20px;">${items}</ul>
  <p style="margin-top:16px;color:#6b7280;font-size:13px;">Once clear, reply to this email and we'll run the pro forma.</p>
</body>
</html>`;
  }

  private buildClarificationText(
    unparseable: ParsedAssumptions['unparseable'],
  ): string {
    const lines = unparseable.map(
      (u) => `- ${u.key}: couldn't interpret "${u.raw}" — ${u.reason}`,
    );
    return `A few assumptions need clarification:\n\n${lines.join('\n')}\n\nReply with restated values.`;
  }
}

function buildMessageId(
  runId: string,
  phase: 'ask' | 'clarify' | 'deliver' | 'answer',
): string {
  return `<uw-${runId}-${phase}-${randomUUID()}@${MESSAGE_ID_DOMAIN}>`;
}

function shortRun(runId: string): string {
  return runId.slice(0, 8);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
