import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Exclude } from 'class-transformer';

export class ConnectUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  // @Exclude()
  password: string;
}
