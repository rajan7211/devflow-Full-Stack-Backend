import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role, UserStatus, OtpPurpose } from '../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Find a user by email.
   * If includeSecrets is true, selects password, OTP, and refreshToken fields.
   */
  async findByEmail(
    email: string,
    includeSecrets = false,
  ): Promise<User | null> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() });

    if (includeSecrets) {
      query
        .addSelect('user.password')
        .addSelect('user.otpCode')
        .addSelect('user.otpPurpose')
        .addSelect('user.otpExpiresAt')
        .addSelect('user.otpLastSentAt')
        .addSelect('user.refreshToken');
    }

    return query.getOne();
  }

  async findById(id: string, includeSecrets = false): Promise<User | null> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id });

    if (includeSecrets) {
      query
        .addSelect('user.password')
        .addSelect('user.otpCode')
        .addSelect('user.otpPurpose')
        .addSelect('user.otpExpiresAt')
        .addSelect('user.otpLastSentAt')
        .addSelect('user.refreshToken');
    }

    return query.getOne();
  }

  async count(): Promise<number> {
    return this.usersRepository.count();
  }

  /**
   * Register a user with status PENDING_VERIFICATION and initial OTP.
   */
  async createPendingUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    otpCode: string;
    otpExpiresAt: Date;
    role?: Role;
  }): Promise<User> {
    const existing = await this.findByEmail(data.email, true);

    // If user already exists and is already active, throw conflict error
    if (existing && existing.status !== UserStatus.PENDING_VERIFICATION) {
      throw new ConflictException('An account with this email already exists');
    }

    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
    const avatar = data.firstName.trim().charAt(0).toUpperCase();

    // If previously registered but never verified, overwrite with new credentials and OTP
    if (existing && existing.status === UserStatus.PENDING_VERIFICATION) {
      existing.firstName = data.firstName.trim();
      existing.lastName = data.lastName.trim();
      existing.name = fullName;
      existing.password = data.password;
      existing.avatar = avatar;
      existing.otpCode = data.otpCode;
      existing.otpPurpose = OtpPurpose.REGISTRATION;
      existing.otpExpiresAt = data.otpExpiresAt;
      existing.otpLastSentAt = new Date();
      return this.usersRepository.save(existing);
    }

    const user = this.usersRepository.create({
      email: data.email.toLowerCase().trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      name: fullName,
      password: data.password,
      role: data.role ?? Role.DEVELOPER,
      status: UserStatus.PENDING_VERIFICATION,
      avatar,
      otpCode: data.otpCode,
      otpPurpose: OtpPurpose.REGISTRATION,
      otpExpiresAt: data.otpExpiresAt,
      otpLastSentAt: new Date(),
    });

    return this.usersRepository.save(user);
  }

  /**
   * Mark user active and clear OTP code after successful verification.
   */
  async activateUser(id: string): Promise<User> {
    await this.usersRepository.update(id, {
      status: UserStatus.ACTIVE,
      otpCode: undefined,
      otpPurpose: undefined,
      otpExpiresAt: undefined,
    });

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Store a new OTP code and timestamp on the user.
   */
  async updateOtp(
    id: string,
    otpCode: string,
    otpPurpose: OtpPurpose,
    otpExpiresAt: Date,
  ): Promise<void> {
    await this.usersRepository.update(id, {
      otpCode,
      otpPurpose,
      otpExpiresAt,
      otpLastSentAt: new Date(),
    });
  }

  /**
   * Clear OTP code after verification.
   */
  async clearOtp(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      otpCode: undefined,
      otpPurpose: undefined,
      otpExpiresAt: undefined,
    });
  }

  /**
   * Save or clear refresh token for user.
   */
  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.usersRepository.update(id, {
      refreshToken: refreshToken ?? undefined,
    });
  }

  /**
   * Update password and clear OTP.
   */
  async updatePassword(id: string, newHashedPassword: string): Promise<void> {
    const result = await this.usersRepository.update(id, {
      password: newHashedPassword,
      otpCode: undefined,
      otpPurpose: undefined,
      otpExpiresAt: undefined,
    });

    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
