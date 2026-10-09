import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({
    example: 'rajan@example.com',
    description: 'Email address to resend OTP to',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'REGISTRATION',
    description: 'Purpose: REGISTRATION or RESET_PASSWORD',
    default: 'REGISTRATION',
  })
  @IsOptional()
  @IsString()
  purpose?: string;
}
