import { JobType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  location!: string;

  /** Monthly salary lower bound in IDR. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin!: number;

  /** Monthly salary upper bound in IDR. Must be >= salaryMin (checked in the service). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax!: number;

  @IsEnum(JobType)
  jobType!: JobType;
}
