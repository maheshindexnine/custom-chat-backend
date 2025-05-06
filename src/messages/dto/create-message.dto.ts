import {
  IsString,
  IsOptional,
  IsMongoId,
  ValidateNested,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

class AttachmentDto {
  @IsString()
  filename: string;

  @IsString()
  originalName: string;

  @IsString()
  mimeType: string;

  @IsOptional()
  size: number;
}

export class CreateMessageDto {
  @IsMongoId()
  sender: string;

  @IsMongoId()
  @IsOptional()
  receiver?: string;

  @IsMongoId()
  @IsOptional()
  group?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  attachment?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  };

  @IsBoolean()
  @IsOptional()
  isForwarded?: boolean;

  @IsMongoId()
  @IsOptional()
  replyTo?: string;
}
