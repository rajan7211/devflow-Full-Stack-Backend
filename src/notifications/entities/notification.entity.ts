import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { NotificationType } from '../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification extends BaseEntity {
  @ManyToOne(() => User, (user) => user.notifications, {
    onDelete: 'CASCADE',
    eager: true,
  })
  recipient: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'uuid', nullable: true })
  relatedTask?: string;

  @Column({ type: 'uuid', nullable: true })
  relatedProject?: string;
}
