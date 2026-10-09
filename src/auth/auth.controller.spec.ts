jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role, UserStatus } from '../common/enums';
import { User } from '../users/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<Record<keyof AuthService, jest.Mock>>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    name: 'Rajan Patel',
    email: 'rajan@example.com',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      verifyOtp: jest.fn(),
      resendOtp: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      getProfile: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('getProfile (/api/auth/me)', () => {
    it('should return the current user profile from AuthService.getProfile', async () => {
      const user = mockUser as User;
      (authService.getProfile as jest.Mock).mockResolvedValue(user);

      const result = await controller.getProfile(user);
      expect(result).toBe(user);
      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('login (/api/auth/login)', () => {
    it('should forward credentials to AuthService.login', async () => {
      const expectedResponse = {
        user: mockUser as User,
        token: 'mock-token',
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
      };
      (authService.login as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.login({
        email: 'rajan@example.com',
        password: 'Password@123',
      });

      expect(result).toEqual(expectedResponse);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'rajan@example.com',
        password: 'Password@123',
      });
    });
  });

  describe('logout (/api/auth/logout)', () => {
    it('should forward current user id to AuthService.logout', async () => {
      (authService.logout as jest.Mock).mockResolvedValue({
        message: 'Logged out successfully',
      });

      const result = await controller.logout(mockUser as User);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authService.logout).toHaveBeenCalledWith('user-uuid-1');
    });
  });
});
