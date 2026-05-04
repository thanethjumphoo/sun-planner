import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TargetSyncItem } from './target-sync-item.entity';
import { OracleIntegrationService } from './oracle-integration.service';

@Controller('api/erp')
export class ErpIntegrationController {
  constructor(
    @InjectRepository(TargetSyncItem)
    private targetItemRepo: Repository<TargetSyncItem>,
    private oracleService: OracleIntegrationService,
  ) {}

  // Get all target item codes
  @Get('target-items')
  async getTargetItems() {
    const items = await this.targetItemRepo.find({ order: { createdAt: 'DESC' } });
    return items.map(item => item.itemCode);
  }

  // Add new item codes
  @Post('target-items')
  async addTargetItems(@Body() body: { itemCodes: string[] }) {
    if (!body.itemCodes || !Array.isArray(body.itemCodes)) return { success: false };
    
    for (const code of body.itemCodes) {
      const exists = await this.targetItemRepo.findOne({ where: { itemCode: code } });
      if (!exists) {
        const newItem = this.targetItemRepo.create({ itemCode: code });
        await this.targetItemRepo.save(newItem);
      }
    }
    return { success: true };
  }

  // Remove an item code
  @Delete('target-items/:code')
  async removeTargetItem(@Param('code') code: string) {
    await this.targetItemRepo.delete({ itemCode: code });
    return { success: true };
  }

  // Trigger sync for all target items
  @Post('sync-items')
  async syncTargetItems() {
    const items = await this.targetItemRepo.find();
    const codes = items.map(i => i.itemCode);
    if (codes.length === 0) return { message: 'No item codes to sync' };
    
    const syncedItems = await this.oracleService.syncItems(codes);
    return { success: true, count: syncedItems.length, data: syncedItems };
  }

  // Trigger sync for order headers from Oracle ERP
  @Post('sync-order-headers')
  async syncOrderHeaders() {
    const syncedOrders = await this.oracleService.syncOrderHeaders();
    return { success: true, count: syncedOrders.length, data: syncedOrders };
  }

  // Get synced order headers from local DB
  @Get('order-headers')
  async getOrderHeaders() {
    const orders = await this.oracleService.getLocalOrderHeaders();
    return orders;
  }

  // Trigger sync for order lines from Oracle ERP
  @Post('sync-order-lines')
  async syncOrderLines() {
    const syncedLines = await this.oracleService.syncOrderLines();
    return { success: true, count: syncedLines.length, data: syncedLines };
  }

  // Get synced order lines from local DB
  @Get('order-lines')
  async getOrderLines() {
    const lines = await this.oracleService.getLocalOrderLines();
    return lines;
  }

  // Get enriched orders for Demand Management (headers + lines + item desc)
  @Get('demand-orders')
  async getDemandOrders() {
    return this.oracleService.getDemandOrders();
  }
}
