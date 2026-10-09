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
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { UsersService } from '../src/users/users.service';
import { MailService } from '../src/mail/mail.service';
import { Role, UserStatus } from '../src/common/enums';
import { User } from '../src/users/entities/user.entity';

describe('GET /api/auth/me (HTTP End-to-End)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockUser: Partial<User> = {
    id: 'b1234567-89ab-cdef-0123-456789abcdef',
    name: 'Rajan Patel',
    email: 'rajan@example.com',
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
  };

  const usersServiceMock = {
    findById: jest.fn().mockImplementation((id: string) => {
      if (id === mockUser.id) {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve(null);
    }),
  };

  const mailServiceMock = {
    sendOtpEmail: jest.fn().mockResolvedValue(undefined),
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
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: MailService, useValue: mailServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    jwtService = app.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. should return 401 Unauthorized when no Authorization header is provided', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    ).get('/api/auth/me');
    expect(response.status).toBe(401);
    const body = response.body as { message?: string };
    expect(body.message).toBe('Unauthorized');
  });

  it('2. should return 200 OK with user profile when valid Bearer token is sent', async () => {
    const token = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });

    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const body = response.body as {
      email?: string;
      name?: string;
      id?: string;
    };
    expect(body.email).toBe('rajan@example.com');
    expect(body.name).toBe('Rajan Patel');
    expect(body.id).toBe(mockUser.id);
  });

  it('3. should return 200 OK when raw token is sent (without "Bearer " prefix)', async () => {
    const token = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });

    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/api/auth/me')
      .set('Authorization', token);

    expect(response.status).toBe(200);
    const body = response.body as { email?: string };
    expect(body.email).toBe('rajan@example.com');
  });

  it('4. should return 200 OK when duplicate "Bearer Bearer " is sent (Swagger copy-paste fix)', async () => {
    const token = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });

    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/api/auth/me')
      .set('Authorization', `Bearer Bearer ${token}`);

    expect(response.status).toBe(200);
    const body = response.body as { email?: string };
    expect(body.email).toBe('rajan@example.com');
  });

  it('5. should return 401 Unauthorized when an invalid token is provided', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-value');

    expect(response.status).toBe(401);
  });
});
