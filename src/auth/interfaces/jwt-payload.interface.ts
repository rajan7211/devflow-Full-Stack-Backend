import { Role } from '../../common/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
