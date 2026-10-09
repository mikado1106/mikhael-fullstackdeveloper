import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const CV_MAX_SIZE_BYTES = 5_000_000;
export const CV_MIME_TYPE = 'application/pdf';

export class UploadUrlDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(180)
  @Matches(/^[^/\\\x00-\x1f\x7f]+\.pdf$/i, {
    message: 'fileName must be a PDF filename without path separators',
  })
  fileName!: string;

  @IsInt()
  @Min(1)
  @Max(CV_MAX_SIZE_BYTES)
  sizeBytes!: number;

  @IsString()
  @Matches(/^application\/pdf$/)
  mimeType!: string;
}
