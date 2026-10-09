import { IsUUID } from 'class-validator';

export class FinalizeCvDto {
  @IsUUID()
  attemptId!: string;
}
