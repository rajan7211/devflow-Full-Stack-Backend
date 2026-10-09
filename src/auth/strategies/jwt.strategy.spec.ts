jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { Role, UserStatus } from '../../common/enums';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: {
    findById: jest.Mock;
  };

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    name: 'Rajan Patel',
    email: 'rajan@example.com',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('super-secret-jwt-key'),
          },
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and return user when valid payload is passed', async () => {
    usersService.findById.mockResolvedValue(mockUser);

    const result = await strategy.validate({
      sub: 'user-uuid-1',
      email: 'rajan@example.com',
      role: Role.DEVELOPER,
    });

    expect(result).toEqual(mockUser);
    expect(usersService.findById).toHaveBeenCalledWith('user-uuid-1');
  });

  it('should throw UnauthorizedException when user not found in database', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'unknown-id',
        email: 'ghost@example.com',
        role: Role.DEVELOPER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user is inactive', async () => {
    usersService.findById.mockResolvedValue({
      ...mockUser,
      status: UserStatus.INACTIVE,
    });

    await expect(
      strategy.validate({
        sub: 'user-uuid-1',
        email: 'rajan@example.com',
        role: Role.DEVELOPER,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
