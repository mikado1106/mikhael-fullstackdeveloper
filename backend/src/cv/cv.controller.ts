import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CvService } from './cv.service';
import { FinalizeCvDto } from './dto/finalize-cv.dto';
import { UploadUrlDto } from './dto/upload-url.dto';

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
@Roles(Role.JOB_SEEKER)
@UsePipes(cvValidationPipe())
export class CvController {
  constructor(private readonly cv: CvService) {}

  @Post('upload-url')
  @HttpCode(201)
  issueUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadUrlDto,
  ) {
    return this.cv.issueUploadUrl(user.id, dto);
  }

  @Post('finalize')
  @HttpCode(200)
  finalize(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FinalizeCvDto,
  ) {
    return this.cv.finalize(user.id, dto.attemptId);
  }

  @Get()
  getCv(@CurrentUser() user: AuthenticatedUser) {
    return this.cv.getCv(user.id);
  }

  @Get('download-url')
  getDownloadUrl(@CurrentUser() user: AuthenticatedUser) {
    return this.cv.getDownloadUrl(user.id);
  }
}

@Controller('applications')
@Roles(Role.COMPANY)
export class ApplicationCvController {
  constructor(private readonly cv: CvService) {}

  @Get(':id/cv-url')
  getApplicationCvUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    return this.cv.getApplicationCvUrl(user.id, applicationId);
  }
}
