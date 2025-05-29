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
  IsArray,
} from 'class-validator';
import { Exclude } from 'class-transformer';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsOptional()
  @IsMongoId({ each: true })
  members: string[];

  @IsString()
  @IsOptional()
  @IsMongoId()
  createdBy: string;

  @IsString()
  @IsOptional()
  @IsMongoId()
  organizationId: string;
}
