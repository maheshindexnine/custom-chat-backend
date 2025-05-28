import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Exclude } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsString()
  @IsNotEmpty()
  // @Exclude()
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['user', 'admin', 'vendor'])
  type?: 'user' | 'admin' | 'vendor';

  @IsOptional()
  @IsMongoId()
  organizationId?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
