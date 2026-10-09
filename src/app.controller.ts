import { Controller, Get } from '@nestjs/common';
import moment from 'moment';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'devflow-backend',
      timestamp: moment().toISOString(),
    };
  }
}
