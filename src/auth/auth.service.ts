import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import {
  RegisterDto,
  VerifyOtpDto,
  ResendOtpDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role, UserStatus, OtpPurpose } from '../common/enums';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Generate a random 6-digit numeric OTP.
   */
  private generateNumericOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Helper to sign an access token and a refresh token.
   */
  private generateTokens(user: User): {
    token: string;
    accessToken: string;
    refreshToken: string;
  } {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(accessPayload, { expiresIn: '1d' });

    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: '7d',
    });

    return { token, accessToken: token, refreshToken };
  }

  /**
   * Start Registration.
   * Creates pending user, generates 6-digit OTP, and emails it.
   */
  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing && existing.status !== UserStatus.PENDING_VERIFICATION) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash user password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Generate 6-digit OTP with 10-minute expiry
    const otp = this.generateNumericOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // First registered user becomes ADMIN, others become DEVELOPER
    const totalUsers = await this.usersService.count();
    const role = totalUsers === 0 ? Role.ADMIN : Role.DEVELOPER;

    // Save pending user record
    await this.usersService.createPendingUser({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: hashedPassword,
      otpCode: otp,
      otpExpiresAt: expiresAt,
      role,
    });

    // Send verification email via Nodemailer
    await this.mailService.sendOtpEmail(
      dto.email,
      otp,
      OtpPurpose.REGISTRATION,
    );

    return {
      message:
        'Registration initiated. Please check your email for the 6-digit verification code.',
    };
  }

  /**
   * Verify Registration or Password-Reset OTP.
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{
    message: string;
    user: User;
    token: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new BadRequestException('Invalid email or verification code');
    }

    if (user.otpCode !== dto.otp) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    // Activate the user account and clear OTP
    const activeUser = await this.usersService.activateUser(user.id);

    // Generate login tokens
    const { token, accessToken, refreshToken } =
      this.generateTokens(activeUser);
    await this.usersService.updateRefreshToken(activeUser.id, refreshToken);

    return {
      message: 'Account verified and activated successfully',
      user: activeUser,
      token,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Resend OTP with a 60-second cooldown to prevent spam.
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new NotFoundException('No account found with this email');
    }

    // 60-second cooldown check
    if (user.otpLastSentAt) {
      const secondsSinceLastOtp =
        (Date.now() - new Date(user.otpLastSentAt).getTime()) / 1000;
      if (secondsSinceLastOtp < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceLastOtp);
        throw new BadRequestException(
          `Please wait ${waitSeconds} seconds before requesting a new code.`,
        );
      }
    }

    const purpose =
      dto.purpose === 'RESET_PASSWORD'
        ? OtpPurpose.RESET_PASSWORD
        : OtpPurpose.REGISTRATION;

    const newOtp = this.generateNumericOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.updateOtp(user.id, newOtp, purpose, expiresAt);
    await this.mailService.sendOtpEmail(user.email, newOtp, purpose);

    return {
      message: 'A new verification code has been sent to your email.',
    };
  }

  /**
   * Login with email and password.
   */
  async login(dto: LoginDto): Promise<{
    user: User;
    token: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in.',
      );
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Your account is currently inactive.');
    }

    const { token, accessToken, refreshToken } = this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    delete (user as { password?: string }).password;

    return { user, token, accessToken, refreshToken };
  }

  /**
   * Rotate access & refresh tokens.
   */
  async refresh(
    dto: RefreshTokenDto,
  ): Promise<{ token: string; accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<{ sub: string; type?: string }>(
        dto.refreshToken,
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      const user = await this.usersService.findById(payload.sub, true);
      if (!user || user.refreshToken !== dto.refreshToken) {
        throw new UnauthorizedException('Invalid or revoked refresh token');
      }

      const newTokens = this.generateTokens(user);
      await this.usersService.updateRefreshToken(
        user.id,
        newTokens.refreshToken,
      );

      return newTokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user by revoking their stored refresh token.
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  /**
   * Get authenticated user profile by user ID.
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return user;
  }

  /**
   * Request password reset code via email.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      return {
        message:
          'If an account exists with this email, a password reset code has been sent.',
      };
    }

    const otp = this.generateNumericOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.updateOtp(
      user.id,
      otp,
      OtpPurpose.RESET_PASSWORD,
      expiresAt,
    );
    await this.mailService.sendOtpEmail(
      user.email,
      otp,
      OtpPurpose.RESET_PASSWORD,
    );

    return {
      message:
        'If an account exists with this email, a password reset code has been sent.',
    };
  }

  /**
   * Verify reset OTP and set new password.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new BadRequestException('Invalid email or reset code');
    }

    if (user.otpCode !== dto.otp) {
      throw new BadRequestException('Invalid reset code');
    }

    if (user.otpPurpose !== OtpPurpose.RESET_PASSWORD) {
      throw new BadRequestException('Invalid reset code purpose');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException(
        'Reset code has expired. Please request a new code.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: 'Password has been successfully reset.' };
  }

  /**
   * Change password for logged-in user.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(userId, hashedPassword);

    return { message: 'Password changed successfully.' };
  }
}
