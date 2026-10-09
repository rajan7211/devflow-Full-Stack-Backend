import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../../common/enums';

export class UpdateStatusDto {
  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    description: 'Updated user account status',
  })
  @IsEnum(UserStatus)
  status: UserStatus;
}

