import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { SavedJobsQueryDto } from './dto/saved-jobs-query.dto';
import { SavedJobsService } from './saved-jobs.service';

@Controller()
@Roles(Role.JOB_SEEKER)
export class SavedJobsController {
  constructor(private readonly savedJobsService: SavedJobsService) {}

  @Post('jobs/:id/save')
  @HttpCode(HttpStatus.OK)
  save(
    @Param('id', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.savedJobsService.save(jobId, user);
  }

  @Delete('jobs/:id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.savedJobsService.remove(jobId, user);
  }

  @Get('me/saved-jobs')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SavedJobsQueryDto,
  ) {
    return this.savedJobsService.findMine(user, query);
  }
}
