jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  getRepositoryToken: () => 'UserRepository',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role, UserStatus } from '../common/enums';
import { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    getStats: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    updateRole: jest.Mock;
    remove: jest.Mock;
  };

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    name: 'Rajan Patel',
    email: 'rajan@example.com',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
  };

  const adminUser: Partial<User> = {
    id: 'admin-uuid',
    name: 'Admin User',
    email: 'admin@example.com',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
      }),
      findOne: jest.fn().mockResolvedValue(mockUser),
      getStats: jest.fn().mockResolvedValue({
        total: 10,
        active: 8,
        inactive: 2,
        pending: 0,
        admins: 2,
        managers: 3,
        developers: 5,
      }),
      create: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue({ ...mockUser, name: 'Updated' }),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockUser, status: UserStatus.INACTIVE }),
      updateRole: jest
        .fn()
        .mockResolvedValue({ ...mockUser, role: Role.MANAGER }),
      remove: jest
        .fn()
        .mockResolvedValue({ message: 'User deleted successfully' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = await controller.findAll({});
      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return aggregated user metrics', async () => {
      const stats = await controller.getStats();
      expect(service.getStats).toHaveBeenCalled();
      expect(stats.total).toBe(10);
      expect(stats.active).toBe(8);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      const result = await controller.findOne('user-uuid-1');
      expect(service.findOne).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create new user', async () => {
      const dto = {
        name: 'Rajan Patel',
        email: 'rajan@example.com',
        role: Role.DEVELOPER,
        password: 'Password123!',
      };
      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should allow admin to update any user', async () => {
      const result = await controller.update(
        'user-uuid-1',
        { name: 'Updated' },
        adminUser as User,
      );
      expect(service.update).toHaveBeenCalledWith('user-uuid-1', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('should allow non-admin user to update their own profile', async () => {
      const result = await controller.update(
        'user-uuid-1',
        { name: 'Updated' },
        mockUser as User,
      );
      expect(service.update).toHaveBeenCalledWith('user-uuid-1', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('should forbid non-admin user from updating another user', async () => {
      await expect(
        controller.update('other-uuid', { name: 'Updated' }, mockUser as User),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      const result = await controller.updateStatus('user-uuid-1', {
        status: UserStatus.INACTIVE,
      });
      expect(service.updateStatus).toHaveBeenCalledWith(
        'user-uuid-1',
        UserStatus.INACTIVE,
      );
      expect(result.status).toBe(UserStatus.INACTIVE);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      const result = await controller.updateRole('user-uuid-1', {
        role: Role.MANAGER,
      });
      expect(service.updateRole).toHaveBeenCalledWith(
        'user-uuid-1',
        Role.MANAGER,
      );
      expect(result.role).toBe(Role.MANAGER);
    });
  });

  describe('remove', () => {
    it('should delete user by id', async () => {
      const result = await controller.remove('user-uuid-1');
      expect(service.remove).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({ message: 'User deleted successfully' });
    });
  });
});
