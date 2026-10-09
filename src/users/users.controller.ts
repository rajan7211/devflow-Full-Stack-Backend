import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateStatusDto,
  UpdateRoleDto,
  QueryUsersDto,
} from './dto';
import { User } from './entities/user.entity';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns paginated list of users',
  })
  async findAll(@Query() query: QueryUsersDto): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.usersService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user count metrics and status distribution' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns aggregated user statistics',
  })
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pending: number;
    admins: number;
    managers: number;
    developers: number;
  }> {
    return this.usersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns user profile',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create and activate a new user (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email already exists',
  })
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile (Admin or self)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden to update other users',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException(
        'You do not have permission to update this user',
      );
    }
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user active/inactive status (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User status updated successfully',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<User> {
    return this.usersService.updateStatus(id, dto.status);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User role updated successfully',
  })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<User> {
    return this.usersService.updateRole(id, dto.role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user by ID (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }
}

