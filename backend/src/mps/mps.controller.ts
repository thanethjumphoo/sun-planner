import { Controller, Post, Body, Get, Param, Res, Query, Delete, BadRequestException } from '@nestjs/common';
import * as express from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MpsFilletService } from './mps-fillet.service';
import { MpsBilService } from './mps-bil.service';
import { MpsPlan } from '../mps-plan.entity';

@Controller('api/mps')
export class MpsController {
  constructor(
    private readonly mpsFilletService: MpsFilletService,
    private readonly mpsBilService: MpsBilService,
    @InjectRepository(MpsPlan) private mpsPlanRepo: Repository<MpsPlan>
  ) {}

  @Get('allowed-items')
  async getAllowedItems(@Query('partType') partType: string) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return this.mpsBilService.getAllowedItems(pt);
    return this.mpsFilletService.getAllowedItems(pt);
  }

  @Delete('clear/month/:month')
  async clearAllPlansForMonth(@Param('month') month: string, @Query('partType') partType: string) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return this.mpsBilService.clearAllPlansForMonth(month);
    return this.mpsFilletService.clearAllPlansForMonth(month);
  }

  @Post('update-date')
  async updateDate(@Body() body: any) {
    return this.mpsFilletService.updateDate(body);
  }

  @Post('auto-allocate')
  async autoAllocate() {
    return this.mpsFilletService.autoAllocate();
  }

  @Post('generate-unified-leg')
  async generateUnifiedLegPlan(@Body() body: any) {
    return this.mpsFilletService.generateUnifiedLegPlan(body);
  }

  @Post('generate')
  async generatePlan(@Body() body: any) {
    const partType = body.partType || 'fillet';
    if (partType === 'bil') return this.mpsBilService.generatePlan(body);
    return this.mpsFilletService.generatePlan(body);
  }

  @Post('generate-range')
  async generateRange(@Body() body: any) {
    const partType = body.partType || 'fillet';
    if (partType === 'bil') return (this.mpsBilService as any).generateRange(body);
    return (this.mpsFilletService as any).generateRange(body);
  }

  @Get('plans')
  async getPlans(@Query('partType') partType: string) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return (this.mpsBilService as any).getPlans(pt);
    return (this.mpsFilletService as any).getPlans(pt);
  }

  // --- Endpoints that need to look up the plan to know which service to call ---
  private async getServiceByPlanId(id: number) {
    const plan = await this.mpsPlanRepo.findOne({ where: { id } });
    if (plan && plan.partType === 'bil') return this.mpsBilService;
    return this.mpsFilletService;
  }

  @Post('plans/:id/delete')
  async deletePlan(@Body() body: any, @Param('id') id: number) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).deletePlan(body, id);
  }

  @Get('plans/:id/weekly-sizes')
  async getWeeklySizesForPlan(@Param('id') id: number) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).getWeeklySizesForPlan(id);
  }

  @Post('plans/:id/import-weekly')
  async importWeeklyForPlan(@Param('id') id: number) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).importWeeklyForPlan(id);
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: number) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).getPlan(id);
  }

  @Post('plans/:id/approve')
  async approvePlan(@Param('id') id: number) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).approvePlan(id);
  }

  @Post('plans/:id/reject')
  async rejectPlan(@Param('id') id: number) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).rejectPlan(id);
  }

  @Get('approved-orders/:date')
  async getApprovedOrdersForDate(@Param('date') date: string, @Query('partType') partType: string) {
    const pt = partType || 'fillet';
    if (pt === 'bil') return (this.mpsBilService as any).getApprovedOrdersForDate(date);
    return (this.mpsFilletService as any).getApprovedOrdersForDate(date);
  }

  @Post('update-priorities')
  async updatePriorities(@Body() body: any) {
    // Priority logic is shared, safe to route to fillet
    return (this.mpsFilletService as any).updatePriorities(body);
  }

  @Get('plans/:id/export')
  async exportPlan(@Param('id') id: number, @Query('view') view: string, @Res() res: express.Response) {
    const service = await this.getServiceByPlanId(id);
    return (service as any).exportPlan(id, view, res);
  }
}
