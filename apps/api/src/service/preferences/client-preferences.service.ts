import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ClientPreferences {
  dealCriteria?: string;
  logoUrl?: string;
  companyName?: string;
  brandColor?: string;
}

@Injectable()
export class ClientPreferencesService {
  private readonly logger = new Logger(ClientPreferencesService.name);
  private preferences: Map<string, ClientPreferences> = new Map();

  constructor() {
    this.loadPreferences();
  }

  private loadPreferences(): void {
    // Use process.cwd() to get project root, works in both dev and production
    const preferencesPath = join(
      process.cwd(),
      'src',
      'data',
      'preferences.json',
    );

    if (!existsSync(preferencesPath)) {
      this.logger.warn(
        `Preferences file not found at ${preferencesPath}`,
      );
      return;
    }

    try {
      const rawData = readFileSync(preferencesPath, 'utf-8');
      const data = JSON.parse(rawData);

      for (const [key, value] of Object.entries(data)) {
        this.preferences.set(key.toLowerCase(), value as ClientPreferences);
      }

      this.logger.log(
        `Loaded ${this.preferences.size} client preferences from ${preferencesPath}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to load preferences: ${errorMessage}`,
        errorStack,
      );
    }
  }

  getPreferences(email: string): ClientPreferences {
    const emailLower = email.toLowerCase().trim();

    // Exact match
    if (this.preferences.has(emailLower)) {
      this.logger.debug(`Preferences match for ${email}: exact`);
      return this.preferences.get(emailLower)!;
    }

    // Domain wildcard (*@domain.com)
    if (emailLower.includes('@')) {
      const domain = emailLower.split('@')[1];
      const wildcardKey = `*@${domain}`;
      if (this.preferences.has(wildcardKey)) {
        this.logger.debug(`Preferences match for ${email}: domain wildcard`);
        return this.preferences.get(wildcardKey)!;
      }
    }

    // Default
    if (this.preferences.has('_default')) {
      this.logger.debug(`Preferences match for ${email}: default`);
      return this.preferences.get('_default')!;
    }

    // No preferences found
    this.logger.debug(`No preferences found for ${email}`);
    return {};
  }

  reload(): void {
    this.preferences.clear();
    this.loadPreferences();
  }
}

