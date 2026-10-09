import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'rajan@example.com',
    description: 'Email address associated with the account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482915',
    description: '6-digit OTP code received via email',
  })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiPropertyOptional({
    example: 'REGISTRATION',
    description: 'Purpose of OTP: REGISTRATION or RESET_PASSWORD',
    default: 'REGISTRATION',
  })
  @IsOptional()
  @IsString()
  purpose?: string;
}
