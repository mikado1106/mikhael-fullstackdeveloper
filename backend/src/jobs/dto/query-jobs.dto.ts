import { Transform } from 'class-transformer';
import { JobType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const MAX_SALARY = 2147483647;

// Reject empty strings, arrays, decimals and exponential notation instead of
// coercing them into valid salary values. Undefined alone means "not supplied".
function parseSalary(value: unknown): unknown {
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return Number(value);
  }
  return value;
}

export class QueryJobsDto extends PaginationQueryDto {
  /** Case-insensitive literal substring on title, description or company name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  /** Case-insensitive literal substring on job location. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  /** Inclusive lower bound of the requested salary interval, in IDR/month. */
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    parseSalary(obj[key]),
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  salaryMin?: number;

  /** Inclusive upper bound; range ordering is also checked by the service. */
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    parseSalary(obj[key]),
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_SALARY)
  salaryMax?: number;
}
