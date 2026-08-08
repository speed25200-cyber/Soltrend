import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { SetLimitsDto } from './compliance.dto';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('geo')
  geo(@Query('country') country?: string) {
    return { country: country ?? null, allowed: this.compliance.geoAllowed(country) };
  }

  @Get('limits')
  getLimits(@Query('sessionId') sessionId: string) {
    return this.compliance.getLimits(sessionId);
  }

  @Post('limits')
  setLimits(@Body() dto: SetLimitsDto) {
    const { sessionId, ...patch } = dto;
    return this.compliance.setLimits(sessionId, patch);
  }
}
