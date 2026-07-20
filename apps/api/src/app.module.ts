import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SessionStore } from './common/session.store';
import { FairService } from './fair/fair.service';
import { FairController } from './fair/fair.controller';
import { GamesService } from './games/games.service';
import { GamesController } from './games/games.controller';
import { MetricsService } from './metrics/metrics.service';
import { MetricsController } from './metrics/metrics.controller';
import { ComplianceService } from './compliance/compliance.service';
import { ComplianceController } from './compliance/compliance.controller';

/**
 * Single module → all services are shared singletons, so the fair, games,
 * metrics and compliance layers operate on the same in-memory state.
 */
@Module({
  controllers: [AppController, FairController, GamesController, MetricsController, ComplianceController],
  providers: [SessionStore, FairService, GamesService, MetricsService, ComplianceService],
})
export class AppModule {}
