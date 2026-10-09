import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Task } from '../../tasks/entities/task.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { Activity } from '../../activity/entities/activity.entity';

export * from './base.entity';
export * from '../../users/entities/user.entity';
export * from '../../projects/entities/project.entity';
export * from '../../tasks/entities/task.entity';
export * from '../../comments/entities/comment.entity';
export * from '../../notifications/entities/notification.entity';
export * from '../../activity/entities/activity.entity';

export const allEntities = [
  User,
  Project,
  Task,
  Comment,
  Notification,
  Activity,
];
