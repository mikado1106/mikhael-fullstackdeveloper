import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedUser,
  RequestWithUser,
} from '../interfaces/authenticated-user.interface';

function readUser(ctx: ExecutionContext): AuthenticatedUser | undefined {
  return ctx.switchToHttp().getRequest<RequestWithUser>().user;
}

// Cast is safe on guarded routes: JwtAuthGuard rejects before the handler runs.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => readUser(ctx) as AuthenticatedUser,
);

export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => readUser(ctx),
);
