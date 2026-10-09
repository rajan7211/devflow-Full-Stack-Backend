jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  TypeOrmModule: {
    forRootAsync: () => ({ module: class {}, providers: [], exports: [] }),
    forFeature: () => ({ module: class {}, providers: [], exports: [] }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { Role, UserStatus } from '../src/common/enums';
import { User } from '../src/users/entities/user.entity';

describe('Users Endpoints (HTTP End-to-End)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockAdmin: Partial<User> = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Admin User',
    email: 'admin@devflow.com',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockDev: Partial<User> = {
    id: 'd0000000-0000-0000-0000-000000000002',
    name: 'Dev User',
    email: 'dev@devflow.com',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
  };

  const usersServiceMock = {
    findById: jest.fn().mockImplementation((id: string) => {
      if (id === mockAdmin.id) return Promise.resolve(mockAdmin);
      if (id === mockDev.id) return Promise.resolve(mockDev);
      return Promise.resolve(null);
    }),
    findOne: jest.fn().mockImplementation((id: string) => {
      if (id === mockDev.id) return Promise.resolve(mockDev);
      if (id === mockAdmin.id) return Promise.resolve(mockAdmin);
      return Promise.reject(new Error('User not found'));
    }),
    findAll: jest.fn().mockResolvedValue({
      data: [mockAdmin, mockDev],
      total: 2,
      page: 1,
      limit: 10,
    }),
    getStats: jest.fn().mockResolvedValue({
      total: 2,
      active: 2,
      inactive: 0,
      pending: 0,
      admins: 1,
      managers: 0,
      developers: 1,
    }),
    create: jest.fn().mockImplementation((dto) =>
      Promise.resolve({
        id: 'new-user-uuid',
        ...dto,
        status: UserStatus.ACTIVE,
      }),
    ),
    update: jest.fn().mockImplementation((id, dto) =>
      Promise.resolve({
        ...(id === mockDev.id ? mockDev : mockAdmin),
        ...dto,
      }),
    ),
    updateStatus: jest.fn().mockImplementation((id, status) =>
      Promise.resolve({
        ...(id === mockDev.id ? mockDev : mockAdmin),
        status,
      }),
    ),
    updateRole: jest.fn().mockImplementation((id, role) =>
      Promise.resolve({
        ...(id === mockDev.id ? mockDev : mockAdmin),
        role,
      }),
    ),
    remove: jest.fn().mockResolvedValue({ message: 'User deleted successfully' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret-key-at-least-32-chars-long-12345',
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret-key-at-least-32-chars-long-12345',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const getAdminToken = () =>
    jwtService.sign({
      sub: mockAdmin.id,
      email: mockAdmin.email,
      role: mockAdmin.role,
    });

  const getDevToken = () =>
    jwtService.sign({
      sub: mockDev.id,
      email: mockDev.email,
      role: mockDev.role,
    });

  it('GET /api/users should return 401 Unauthorized without token', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('GET /api/users should return 200 with list when authenticated', async () => {
    const token = getDevToken();
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('GET /api/users/stats should return aggregate user stats', async () => {
    const token = getDevToken();
    const res = await request(app.getHttpServer())
      .get('/api/users/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.admins).toBe(1);
    expect(res.body.developers).toBe(1);
  });

  it('GET /api/users/:id should return single user profile', async () => {
    const token = getDevToken();
    const res = await request(app.getHttpServer())
      .get(`/api/users/${mockDev.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.email).toBe(mockDev.email);
  });

  it('POST /api/users should return 403 Forbidden for non-admin', async () => {
    const devToken = getDevToken();
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        name: 'New Member',
        email: 'new@devflow.com',
        role: Role.DEVELOPER,
        password: 'Password123!',
      })
      .expect(403);
  });

  it('POST /api/users should create user when called by ADMIN', async () => {
    const adminToken = getAdminToken();
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Member',
        email: 'new@devflow.com',
        role: Role.DEVELOPER,
        password: 'Password123!',
      })
      .expect(201);

    expect(res.body.name).toBe('New Member');
    expect(res.body.email).toBe('new@devflow.com');
  });

  it('PATCH /api/users/:id/status should update status (Admin only)', async () => {
    const adminToken = getAdminToken();
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${mockDev.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    expect(res.body.status).toBe(UserStatus.INACTIVE);
  });

  it('PATCH /api/users/:id/role should update role (Admin only)', async () => {
    const adminToken = getAdminToken();
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${mockDev.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.MANAGER })
      .expect(200);

    expect(res.body.role).toBe(Role.MANAGER);
  });

  it('DELETE /api/users/:id should delete user (Admin only)', async () => {
    const adminToken = getAdminToken();
    const res = await request(app.getHttpServer())
      .delete(`/api/users/${mockDev.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.message).toBe('User deleted successfully');
  });
});

