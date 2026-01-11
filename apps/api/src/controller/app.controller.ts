import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from '../service/app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(@Res() res: Response): void {
    // Plain text response - more reliable for healthchecks
    res.status(200).send('ok');
  }
}

