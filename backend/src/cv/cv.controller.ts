import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Body,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { CvService } from './cv.service';
import { FinalizeCvDto } from './dto/finalize-cv.dto';
import { UploadUrlDto } from './dto/upload-url.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
  };
};

/*
 * Authentication integration:
 * The application's existing global JWT/session guard must authenticate each
 * request and populate req.user = { id, role } before these guards execute.
 * These guards enforce authorization; they do not authenticate bearer tokens.
 */
@Injectable()
export class CvAuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();

    if (
      !request.user ||
      typeof request.user.id !== 'string' ||
      typeof request.user.role !== 'string'
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required',
      });
    }

    return true;
  }
}

@Injectable()
export class CvSeekerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    if (request.user.role !== 'SEEKER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'A seeker account is required',
      });
    }

    return true;
  }
}

@Injectable()
export class CvCompanyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    if (request.user.role !== 'COMPANY') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'A company account is required',
      });
    }

    return true;
  }
}

function cvValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: () =>
      new HttpException(
        {
          code: 'CV_VALIDATION_FAILED',
          message: 'The CV request is invalid',
        },
        422,
      ),
  });
}

@Controller('me/cv')
@UseGuards(CvAuthenticatedGuard, CvSeekerGuard)
@UsePipes(cvValidationPipe())
export class CvController {
  constructor(private readonly cv: CvService) {}

  @Post('upload-url')
  @HttpCode(201)
  issueUploadUrl(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UploadUrlDto,
  ) {
    return this.cv.issueUploadUrl(request.user.id, dto);
  }

  @Post('finalize')
  @HttpCode(200)
  finalize(
    @Req() request: AuthenticatedRequest,
    @Body() dto: FinalizeCvDto,
  ) {
    return this.cv.finalize(request.user.id, dto.attemptId);
  }

  @Get()
  getCv(@Req() request: AuthenticatedRequest) {
    return this.cv.getCv(request.user.id);
  }

  @Get('download-url')
  getDownloadUrl(@Req() request: AuthenticatedRequest) {
    return this.cv.getDownloadUrl(request.user.id);
  }
}

@Controller('applications')
@UseGuards(CvAuthenticatedGuard, CvCompanyGuard)
export class ApplicationCvController {
  constructor(private readonly cv: CvService) {}

  @Get(':id/cv-url')
  getApplicationCvUrl(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) applicationId: string,
  ) {
    return this.cv.getApplicationCvUrl(request.user.id, applicationId);
  }
}
