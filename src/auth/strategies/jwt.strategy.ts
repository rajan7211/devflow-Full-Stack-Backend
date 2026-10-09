import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';

/**
 * Flexible JWT extractor that handles:
 * - "Bearer <token>"
 * - Accidental "Bearer Bearer <token>" (common copy-paste issue in Swagger UI)
 * - Raw token without "Bearer "
 * - "x-access-token" header
 */
function extractJwtToken(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  if (!req || !req.headers) {
    return null;
  }

  const rawAuth = req.headers.authorization || req.headers.Authorization;
  if (rawAuth) {
    let authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    if (typeof authHeader === 'string') {
      authHeader = authHeader.trim();

      // Strip redundant "Bearer " prefixes (supports Swagger UI copy-paste)
      while (authHeader.toLowerCase().startsWith('bearer ')) {
        authHeader = authHeader.slice(7).trim();
      }

      if (authHeader) {
        return authHeader;
      }
    }
  }

  const customHeader = req.headers['x-access-token'];
  if (customHeader) {
    const token = Array.isArray(customHeader) ? customHeader[0] : customHeader;
    if (typeof token === 'string' && token.trim()) {
      return token.trim();
    }
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtToken,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('User account is inactive');
    }

    return user;
  }
}
