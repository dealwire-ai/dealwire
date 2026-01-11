import { Controller, Get, Res, Req, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetricsService } from '../service/metrics/metrics.service';

@Controller('metrics')
export class MetricsController {
  private readonly metricsUsername: string;
  private readonly metricsPassword: string;

  constructor(private readonly metricsService: MetricsService) {
    // Basic auth credentials from env vars
    this.metricsUsername = process.env.METRICS_USERNAME || 'admin';
    this.metricsPassword = process.env.METRICS_PASSWORD || '';
  }

  @Get()
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Check basic auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
      res.status(401).send('Unauthorized\n');
      return;
    }

    // Parse basic auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Verify credentials
    if (username !== this.metricsUsername || password !== this.metricsPassword) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
      res.status(401).send('Unauthorized\n');
      return;
    }

    // Return metrics
    try {
      const metrics = await this.metricsService.getMetrics();
      res.setHeader('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).send(`Error fetching metrics: ${msg}\n`);
    }
  }
}
