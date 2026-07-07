import { Injectable } from '@nestjs/common';
import { streamText, type CoreMessage } from 'ai';
import { demoAnalystModel } from '../underwriting/model-config';
import { trackLlmStream } from '../llm/tracked-llm';

/**
 * Analyst chat for client demo pages (/demos/*). Unlike DealwireAgentService,
 * this is a pure passthrough: the demo page owns the system prompt and injects
 * its dataset context into the user message — no org tools, no preference
 * loading, no competing persona. Streams plain text.
 */
@Injectable()
export class DemoAnalystService {
  stream(system: string, messages: CoreMessage[]) {
    // The client controls `system`; drop any system-role messages smuggled
    // into the array so there is exactly one persona.
    const chat = messages.filter((m) => m.role !== 'system');
    return trackLlmStream(
      'demo_analyst',
      streamText({
        model: demoAnalystModel(),
        system,
        messages: chat,
      }),
    );
  }
}
