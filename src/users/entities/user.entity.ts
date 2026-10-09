import { Entity, Column, ManyToMany, OneToMany, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role, UserStatus, OtpPurpose } from '../../common/enums';
import { Project } from '../../projects/entities/project.entity';
import { Task } from '../../tasks/entities/task.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Notification } from '../../notifications/entities/notification.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName?: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.DEVELOPER,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  // OTP fields for email verification and password reset (excluded from normal queries)
  @Exclude({ toPlainOnly: true })
  @Column({ type: 'varchar', length: 10, nullable: true, select: false })
  otpCode?: string;

  @Exclude({ toPlainOnly: true })
  @Column({
    type: 'enum',
    enum: OtpPurpose,
    nullable: true,
    select: false,
  })
  otpPurpose?: OtpPurpose;

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'timestamptz', nullable: true, select: false })
  otpExpiresAt?: Date;

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'timestamptz', nullable: true, select: false })
  otpLastSentAt?: Date;

  // Refresh token for session rotation (excluded from normal queries)
  @Exclude({ toPlainOnly: true })
  @Column({ type: 'varchar', length: 500, nullable: true, select: false })
  refreshToken?: string;

  @ManyToMany(() => Project, (project) => project.members)
  projects?: Project[];

  @OneToMany(() => Task, (task) => task.assignee)
  assignedTasks?: Task[];

  @OneToMany(() => Task, (task) => task.createdBy)
  createdTasks?: Task[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments?: Comment[];

  @OneToMany(() => Notification, (notification) => notification.recipient)
  notifications?: Notification[];
}
