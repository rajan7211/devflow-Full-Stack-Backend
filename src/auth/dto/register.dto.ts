import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'rajan@example.com',
    description: 'Unique email address',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'REGISTRATION',
    description: 'Purpose of registration',
    default: 'REGISTRATION',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: 'Secret@123',
    description: 'Account password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
