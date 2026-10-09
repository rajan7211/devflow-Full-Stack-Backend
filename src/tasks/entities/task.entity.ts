import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Priority, TaskStatus } from '../../common/enums';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';

@Entity('tasks')
export class Task extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: Priority,
    default: Priority.MEDIUM,
  })
  priority: Priority;

  @Column({
    type: 'text',
    array: true,
    default: () => 'ARRAY[]::text[]',
  })
  labels: string[];

  @Column({ type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @ManyToOne(() => Project, (project) => project.tasks, {
    onDelete: 'CASCADE',
    eager: true,
  })
  project: Project;

  @ManyToOne(() => User, (user) => user.assignedTasks, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  assignee?: User;

  @ManyToOne(() => User, (user) => user.createdTasks, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  createdBy: User;

  @OneToMany(() => Comment, (comment) => comment.task)
  comments?: Comment[];
}
