import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Email address of the account',
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

  @ApiProperty({
    example: 'NewSecret@456',
    description: 'New password (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
