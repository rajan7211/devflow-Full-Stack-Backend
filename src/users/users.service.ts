import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import moment from 'moment';
import { User } from './entities/user.entity';
import { Role, UserStatus, OtpPurpose } from '../common/enums';
import { CreateUserDto, UpdateUserDto, QueryUsersDto } from './dto';

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
      existing.otpLastSentAt = moment().toDate();
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
      otpLastSentAt: moment().toDate(),
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
      otpLastSentAt: moment().toDate(),
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

  /**
   * List users with search, role/status filtering, and pagination.
   */
  async findAll(
    query: QueryUsersDto,
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const qb = this.usersRepository.createQueryBuilder('user');

    if (query.search && query.search.trim()) {
      qb.andWhere(
        '(LOWER(user.name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    qb.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Find a single user by ID or throw NotFoundException.
   */
  async findOne(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Aggregate statistics for user dashboard and team overview.
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pending: number;
    admins: number;
    managers: number;
    developers: number;
  }> {
    const total = await this.usersRepository.count();
    const active = await this.usersRepository.count({
      where: { status: UserStatus.ACTIVE },
    });
    const inactive = await this.usersRepository.count({
      where: { status: UserStatus.INACTIVE },
    });
    const pending = await this.usersRepository.count({
      where: { status: UserStatus.PENDING_VERIFICATION },
    });
    const admins = await this.usersRepository.count({
      where: { role: Role.ADMIN },
    });
    const managers = await this.usersRepository.count({
      where: { role: Role.MANAGER },
    });
    const developers = await this.usersRepository.count({
      where: { role: Role.DEVELOPER },
    });

    return {
      total,
      active,
      inactive,
      pending,
      admins,
      managers,
      developers,
    };
  }

  /**
   * Create an active user directly (Admin invite/creation).
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const nameParts = dto.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const avatar = dto.avatar || firstName.charAt(0).toUpperCase();

    const user = this.usersRepository.create({
      name: dto.name.trim(),
      firstName,
      lastName,
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
      role: dto.role,
      status: UserStatus.ACTIVE,
      avatar,
    });

    const saved = await this.usersRepository.save(user);
    delete (saved as { password?: string }).password;
    return saved;
  }

  /**
   * Update user profile, email, role, or status.
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (
      dto.email &&
      dto.email.toLowerCase().trim() !== user.email.toLowerCase()
    ) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      user.email = dto.email.toLowerCase().trim();
    }

    if (dto.name) {
      user.name = dto.name.trim();
      const nameParts = user.name.split(' ');
      user.firstName = nameParts[0];
      user.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      if (!dto.avatar && (!user.avatar || user.avatar.length === 1)) {
        user.avatar = user.firstName.charAt(0).toUpperCase();
      }
    }

    if (dto.role) {
      user.role = dto.role;
    }

    if (dto.status) {
      user.status = dto.status;
    }

    if (dto.avatar !== undefined) {
      user.avatar = dto.avatar;
    }

    return this.usersRepository.save(user);
  }

  /**
   * Update user status (e.g. ACTIVE or INACTIVE).
   */
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const user = await this.findOne(id);
    user.status = status;
    return this.usersRepository.save(user);
  }

  /**
   * Update user role (e.g. ADMIN, MANAGER, DEVELOPER).
   */
  async updateRole(id: string, role: Role): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    return this.usersRepository.save(user);
  }

  /**
   * Delete a user by ID.
   */
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    return { message: 'User deleted successfully' };
  }
}
