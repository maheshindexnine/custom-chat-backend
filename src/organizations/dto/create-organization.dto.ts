import { IsString, IsOptional } from 'class-validator';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class CreateOrganizationDto extends CreateUserDto {
  @IsString()
  organizationName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
} 