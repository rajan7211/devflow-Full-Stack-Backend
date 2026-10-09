import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Expose } from 'class-transformer';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose()
  get _id(): string {
    return this.id;
  }

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  toJSON(): Record<string, unknown> {
    return Object.assign({}, this, { _id: this.id }) as unknown as Record<
      string,
      unknown
    >;
  }
}
