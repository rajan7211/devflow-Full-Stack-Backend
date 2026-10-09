import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../common/enums';

export class CreateUserDto {
  @ApiProperty({
    example: 'Rajan Patel',
    description: 'Full name of the user',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'rajan@example.com',
    description: 'Unique email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: Role,
    default: Role.DEVELOPER,
    description: 'Role assigned to the user',
  })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({
    example: 'Password123!',
    description: 'Initial password (min 6 characters)',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: 'R',
    description: 'Avatar initial or URL',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}

