import { Controller, Get, Post, Delete, Body, Param, Query, Res } from '@nestjs/common';
import * as express from 'express';
import { DpsFilletService } from './dps-fillet.service';
import { DpsBilService } from './dps-bil.service';

@Controller('api/dps')
export class DpsController {
  constructor(
    private readonly dpsFilletService: DpsFilletService,
    private readonly dpsBilService: DpsBilService,
  ) {}

  @Get(':date')
  async getPlanByDate(@Param('date') date: string, @Query('partType') partType: string) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return this.dpsBilService.getPlanByDate(date, pt);
    return this.dpsFilletService.getPlanByDate(date, pt);
  }

  @Delete(':date')
  async deletePlan(@Param('date') date: string, @Query('partType') partType: string) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return this.dpsBilService.deletePlan(date, pt);
    return this.dpsFilletService.deletePlan(date, pt);
  }

  @Post(':date/generate')
  async saveGeneratedPlan(@Param('date') date: string, @Body() payload: any) {
    const pt = payload.partType || 'fillet';
    if (pt === 'bil') return this.dpsBilService.saveGeneratedPlan(date, payload);
    return this.dpsFilletService.saveGeneratedPlan(date, payload);
  }

  @Get(':date/export')
  async exportPlan(@Param('date') date: string, @Query('partType') partType: string, @Res() res: express.Response) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return this.dpsBilService.exportPlan(date, pt, res);
    return this.dpsFilletService.exportPlan(date, pt, res);
  }
}
