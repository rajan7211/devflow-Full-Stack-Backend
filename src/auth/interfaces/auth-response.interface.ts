import { User } from '../../users/entities/user.entity';

export interface AuthResponse {
  user: User;
  token: string;
}
