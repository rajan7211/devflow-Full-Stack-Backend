import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ActivityAction } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Task } from '../../tasks/entities/task.entity';

@Entity('activities')
export class Activity extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  user: User;

  @ManyToOne(() => Project, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  project?: Project;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL', eager: true })
  task?: Task;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
