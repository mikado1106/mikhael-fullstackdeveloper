import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, ArrayMaxSize, ArrayNotEmpty } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SavedJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return [...new Set(value.split(',').map((id: string) => id.trim()).filter(Boolean))];
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  jobIds?: string[];
}
