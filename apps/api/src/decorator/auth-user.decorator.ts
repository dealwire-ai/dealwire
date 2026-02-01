import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthPayload } from '../guard/clerk-auth.guard';

export const AuthUser = createParamDecorator(
  (data: keyof AuthPayload | undefined, ctx: ExecutionContext): AuthPayload | string | null => {
    const request = ctx.switchToHttp().getRequest<{ auth?: AuthPayload }>();
    const auth = request.auth;
    if (!auth) return null;
    if (data) return auth[data];
    return auth;
  },
);
