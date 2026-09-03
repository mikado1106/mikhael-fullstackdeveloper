import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(Role)
  role!: Role;

  /** Required when registering as a COMPANY. */
  @ValidateIf((dto: RegisterDto) => dto.role === Role.COMPANY)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  companyDescription?: string;
}
