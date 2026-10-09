import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary:
      'Start registration (sends OTP). Account starts PENDING_VERIFICATION.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Registration initiated. Verification code sent via email.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email is already registered and active.',
  })
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  @ApiOperation({
    summary: 'Verify the OTP. Activates user account based on stored data.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Account verified successfully with access and refresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired OTP code.',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{
    message: string;
    user: User;
    token: string;
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.verifyOtp(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resend-otp')
  @ApiOperation({
    summary: 'Resend the verification code (60s cooldown)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New verification code sent to email.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cooldown active. Please wait 60 seconds.',
  })
  async resendOtp(@Body() dto: ResendOtpDto): Promise<{ message: string }> {
    return this.authService.resendOtp(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login with email + password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User logged in successfully with access and refresh tokens.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or email not verified.',
  })
  async login(@Body() dto: LoginDto): Promise<{
    user: User;
    token: string;
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate tokens using a valid refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens rotated successfully.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token.',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ token: string; accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully.',
  })
  async logout(@CurrentUser() user: User): Promise<{ message: string }> {
    return this.authService.logout(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated identity' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user profile returned successfully.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid access token.',
  })
  async getProfile(@CurrentUser() user: User): Promise<User> {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.authService.getProfile(user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password-reset OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset code sent to email if account exists.',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Verify the reset OTP and set a new password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password has been successfully reset.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired reset OTP.',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Current password is incorrect.',
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.id, dto);
  }
}
