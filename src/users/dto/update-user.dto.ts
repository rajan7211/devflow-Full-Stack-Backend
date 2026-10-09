import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '../../common/enums';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Rajan Patel',
    description: 'Full name of the user',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'rajan@example.com',
    description: 'Email address of the user',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: Role,
    description: 'Role assigned to the user',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Status of the user account',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    example: 'R',
    description: 'Avatar initial or URL',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}
