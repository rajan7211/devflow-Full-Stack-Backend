jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { Role, UserStatus, OtpPurpose } from '../common/enums';
import { User } from '../users/entities/user.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    count: jest.Mock;
    createPendingUser: jest.Mock;
    activateUser: jest.Mock;
    updateOtp: jest.Mock;
    updateRefreshToken: jest.Mock;
    updatePassword: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
    verify: jest.Mock;
  };
  let mailService: {
    sendOtpEmail: jest.Mock;
  };

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    name: 'Rajan Patel',
    firstName: 'Rajan',
    lastName: 'Patel',
    email: 'rajan@example.com',
    password: 'hashed-password',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
    otpCode: '482915',
    otpPurpose: OtpPurpose.REGISTRATION,
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
      createPendingUser: jest.fn(),
      activateUser: jest.fn(),
      updateOtp: jest.fn(),
      updateRefreshToken: jest.fn(),
      updatePassword: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create pending user and send OTP email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.count.mockResolvedValue(1);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await authService.register({
        email: 'rajan@example.com',
        firstName: 'Rajan',
        lastName: 'Patel',
        password: 'Secret@123',
      });

      expect(usersService.createPendingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'rajan@example.com',
          firstName: 'Rajan',
          lastName: 'Patel',
        }),
      );
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith(
        'rajan@example.com',
        expect.any(String),
        OtpPurpose.REGISTRATION,
      );
      expect(result.message).toContain('Registration initiated');
    });

    it('should throw ConflictException if active account exists with email', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      });

      await expect(
        authService.register({
          email: 'rajan@example.com',
          firstName: 'Rajan',
          lastName: 'Patel',
          password: 'Secret@123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyOtp', () => {
    it('should activate user and return tokens when valid OTP provided', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_VERIFICATION,
        otpCode: '482915',
        otpExpiresAt: new Date(Date.now() + 50000),
      });
      usersService.activateUser.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      });

      const result = await authService.verifyOtp({
        email: 'rajan@example.com',
        otp: '482915',
      });

      expect(usersService.activateUser).toHaveBeenCalledWith('user-uuid-1');
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        otpCode: '482915',
        otpExpiresAt: new Date(Date.now() + 50000),
      });

      await expect(
        authService.verifyOtp({
          email: 'rajan@example.com',
          otp: '999999',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should authenticate active user and return tokens', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({
        email: 'rajan@example.com',
        password: 'Secret@123',
      });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('rajan@example.com');
    });

    it('should reject login if email is not yet verified', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_VERIFICATION,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        authService.login({
          email: 'rajan@example.com',
          password: 'Secret@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword and resetPassword', () => {
    it('should send reset OTP email when user exists', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser });

      const result = await authService.forgotPassword({
        email: 'rajan@example.com',
      });

      expect(usersService.updateOtp).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.any(String),
        OtpPurpose.RESET_PASSWORD,
        expect.any(Date),
      );
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith(
        'rajan@example.com',
        expect.any(String),
        OtpPurpose.RESET_PASSWORD,
      );
      expect(result.message).toContain('password reset code');
    });

    it('should reset password with valid OTP and new password', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        otpCode: '482915',
        otpPurpose: OtpPurpose.RESET_PASSWORD,
        otpExpiresAt: new Date(Date.now() + 50000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      const result = await authService.resetPassword({
        email: 'rajan@example.com',
        otp: '482915',
        newPassword: 'NewSecret@456',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'user-uuid-1',
        'new-hashed-password',
      );
      expect(result.message).toContain('successfully reset');
    });
  });

  describe('getProfile', () => {
    it('should return user profile by id', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await authService.getProfile('user-uuid-1');
      expect(result).toEqual(mockUser);
      expect(usersService.findById).toHaveBeenCalledWith('user-uuid-1');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getProfile('unknown-id')).rejects.toThrow();
    });
  });
});
