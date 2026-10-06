import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns the starter message at the API root', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });

  it('returns a healthy status and an ISO timestamp', () => {
    const result = appController.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('devflow-backend');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
