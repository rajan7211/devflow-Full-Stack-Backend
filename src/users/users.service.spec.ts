jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  getRepositoryToken: () => 'UserRepository',
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role, UserStatus } from '../common/enums';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const mockUser: User = {
    id: 'user-uuid-1',
    _id: 'user-uuid-1',
    name: 'Rajan Patel',
    firstName: 'Rajan',
    lastName: 'Patel',
    email: 'rajan@example.com',
    password: 'hashed_password',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
    avatar: 'R',
    createdAt: new Date(),
    updatedAt: new Date(),
    toJSON: () => ({ id: 'user-uuid-1', _id: 'user-uuid-1' }),
  };

  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    addSelect: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getOne: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
    };

    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(
        (dto: Partial<User>) =>
          ({ ...dto, id: 'user-uuid-1' }) as unknown as User,
      ),
      save: jest.fn().mockImplementation((u: User) => Promise.resolve(u)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn().mockResolvedValue(mockUser),
      createQueryBuilder: jest.fn(() => qb),
    };

    service = new UsersService(repository as unknown as Repository<User>);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should query user by email', async () => {
      qb.getOne.mockResolvedValue(mockUser);
      const user = await service.findByEmail('rajan@example.com');
      expect(qb.where).toHaveBeenCalledWith(
        'LOWER(user.email) = LOWER(:email)',
        {
          email: 'rajan@example.com',
        },
      );
      expect(user).toEqual(mockUser);
    });

    it('should select secrets if includeSecrets is true', async () => {
      qb.getOne.mockResolvedValue(mockUser);
      await service.findByEmail('rajan@example.com', true);
      expect(qb.addSelect).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should query user by ID', async () => {
      qb.getOne.mockResolvedValue(mockUser);
      const user = await service.findById('user-uuid-1');
      expect(qb.where).toHaveBeenCalledWith('user.id = :id', {
        id: 'user-uuid-1',
      });
      expect(user).toEqual(mockUser);
    });
  });

  describe('findOne', () => {
    it('should return user if found', async () => {
      qb.getOne.mockResolvedValue(mockUser);
      const user = await service.findOne('user-uuid-1');
      expect(user).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      qb.getOne.mockResolvedValue(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users with defaults', async () => {
      const result = await service.findAll({});
      expect(result).toEqual({
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should apply search, role and status filters', async () => {
      await service.findAll({
        search: 'rajan',
        role: Role.DEVELOPER,
        status: UserStatus.ACTIVE,
        page: 2,
        limit: 5,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(LOWER(user.name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: '%rajan%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('user.role = :role', {
        role: Role.DEVELOPER,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('user.status = :status', {
        status: UserStatus.ACTIVE,
      });
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });
  });

  describe('getStats', () => {
    it('should return user aggregate statistics', async () => {
      repository.count.mockResolvedValue(5);
      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 5,
        active: 5,
        inactive: 5,
        pending: 5,
        admins: 5,
        managers: 5,
        developers: 5,
      });
    });
  });

  describe('create', () => {
    it('should create and save an active user', async () => {
      qb.getOne.mockResolvedValue(null);

      const created = await service.create({
        name: 'Rajan Patel',
        email: 'rajan@example.com',
        role: Role.DEVELOPER,
        password: 'Password123!',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rajan Patel',
          email: 'rajan@example.com',
          role: Role.DEVELOPER,
          status: UserStatus.ACTIVE,
        }),
      );
      expect(created.email).toBe('rajan@example.com');
    });

    it('should throw ConflictException if email exists', async () => {
      qb.getOne.mockResolvedValue(mockUser);

      await expect(
        service.create({
          name: 'Rajan Patel',
          email: 'rajan@example.com',
          role: Role.DEVELOPER,
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update user fields successfully', async () => {
      qb.getOne.mockResolvedValue({ ...mockUser });

      const updated = await service.update('user-uuid-1', {
        name: 'Rajan Updated',
        role: Role.MANAGER,
      });

      expect(updated.name).toBe('Rajan Updated');
      expect(updated.role).toBe(Role.MANAGER);
    });

    it('should throw ConflictException if new email is already taken', async () => {
      qb.getOne
        .mockResolvedValueOnce({ ...mockUser, email: 'original@example.com' })
        .mockResolvedValueOnce({
          id: 'other-uuid',
          email: 'taken@example.com',
        });

      await expect(
        service.update('user-uuid-1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus', () => {
    it('should change user status', async () => {
      qb.getOne.mockResolvedValue({ ...mockUser });
      const updated = await service.updateStatus(
        'user-uuid-1',
        UserStatus.INACTIVE,
      );
      expect(updated.status).toBe(UserStatus.INACTIVE);
    });
  });

  describe('updateRole', () => {
    it('should change user role', async () => {
      qb.getOne.mockResolvedValue({ ...mockUser });
      const updated = await service.updateRole('user-uuid-1', Role.ADMIN);
      expect(updated.role).toBe(Role.ADMIN);
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      qb.getOne.mockResolvedValue({ ...mockUser });
      const result = await service.remove('user-uuid-1');
      expect(repository.remove).toHaveBeenCalled();
      expect(result).toEqual({ message: 'User deleted successfully' });
    });
  });

  describe('createPendingUser and activateUser', () => {
    it('should create pending user with registration OTP', async () => {
      qb.getOne.mockResolvedValue(null);
      await service.createPendingUser({
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'hash',
        otpCode: '123456',
        otpExpiresAt: new Date(),
      });
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should activate user and clear OTP fields', async () => {
      qb.getOne.mockResolvedValue(mockUser);
      const active = await service.activateUser('user-uuid-1');
      expect(repository.update).toHaveBeenCalledWith('user-uuid-1', {
        status: UserStatus.ACTIVE,
        otpCode: undefined,
        otpPurpose: undefined,
        otpExpiresAt: undefined,
      });
      expect(active).toEqual(mockUser);
    });
  });
});
