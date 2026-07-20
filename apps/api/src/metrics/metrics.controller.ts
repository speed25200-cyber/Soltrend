import { Controller, Get, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('games')
  games(@Query('limit') limit?: string) {
    return this.metrics.topGames(limit ? parseInt(limit) : 20);
  }

  @Get('creators')
  creators(@Query('limit') limit?: string) {
    return this.metrics.topCreators(limit ? parseInt(limit) : 20);
  }
}
