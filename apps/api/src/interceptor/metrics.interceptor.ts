import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { MetricsService } from '../service/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip if metrics are disabled
    if (!this.metricsService.isEnabled()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // Extract controller name
    const controller = context.getClass().name;

    // Build service name: controller name without "Controller" suffix
    // e.g., "MicrosoftWebhookController" -> "microsoftwebhook"
    const serviceName = controller.replace(/Controller$/, '').toLowerCase();

    // Start timing
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        // Success case
        const durationSeconds = (Date.now() - startTime) / 1000;
        this.metricsService.recordRestApiCallDuration(
          serviceName,
          method,
          'success',
          durationSeconds,
        );
      }),
      catchError((error) => {
        // Error case
        const durationSeconds = (Date.now() - startTime) / 1000;
        this.metricsService.recordRestApiCallDuration(
          serviceName,
          method,
          'error',
          durationSeconds,
        );
        return throwError(() => error);
      }),
    );
  }
}
