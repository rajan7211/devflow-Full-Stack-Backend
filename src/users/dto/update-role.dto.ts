import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums';

export class UpdateRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.DEVELOPER,
    description: 'Updated user role',
  })
  @IsEnum(Role)
  role: Role;
}

