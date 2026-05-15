import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ProductSpec } from './product-spec.entity';
import { StgErpItem } from './stg-erp-item.entity';

@Controller('api/product-spec')
export class ProductSpecController {
  constructor(
    @InjectRepository(ProductSpec)
    private productSpecRepo: Repository<ProductSpec>,
    @InjectRepository(StgErpItem)
    private stgItemRepo: Repository<StgErpItem>,
  ) { }

  // ─── Get all ERP items from stg_erp_items (for selection) ───
  @Get('erp-items')
  async getErpItems(@Query('search') search?: string) {
    if (search) {
      // Search by item code or description using OR
      const items = await this.stgItemRepo.find({
        where: [
          { erpItemCode: Like(`%${search}%`) },
          { erpItemDesc: Like(`%${search}%`) }
        ],
        order: { erpItemCode: 'ASC' },
      });
      return items;
    }

    const items = await this.stgItemRepo.find({
      order: { erpItemCode: 'ASC' },
    });
    return items;
  }

  // ─── Get all product specs ───
  @Get()
  async getAll() {
    const specs = await this.productSpecRepo.find({
      order: { erpItemCode: 'ASC' },
    });

    // Enrich description from StgErpItem if missing
    const items = await this.stgItemRepo.find();
    const itemMap = new Map<string, string>();
    items.forEach(i => {
      if (i.erpItemCode) itemMap.set(i.erpItemCode, i.erpItemDesc);
    });

    return specs.map(spec => ({
      ...spec,
      erpItemDesc: spec.erpItemDesc || itemMap.get(spec.erpItemCode) || '-'
    }));
  }

  // ─── Get single product spec by id ───
  @Get(':id')
  async getOne(@Param('id') id: number) {
    return this.productSpecRepo.findOne({ where: { id } });
  }

  // ─── Create a new product spec (from selected ERP item) ───
  @Post()
  async create(@Body() body: {
    erpItemId: number;
    erpItemCode: string;
    erpItemDesc: string;
    erpItemType: string;
    productType: string;
    productSize: string;
    productYield: number;
    productWeight: number;
    productSpeed: number;
    productLead: number;
  }) {
    // Check if spec already exists for this item code
    const existing = await this.productSpecRepo.findOne({
      where: { erpItemCode: body.erpItemCode },
    });
    if (existing) {
      return { success: false, message: 'Product spec already exists for this item code' };
    }

    // Fetch description from StgErpItem if body one is missing
    let desc = body.erpItemDesc;
    if (!desc || desc === '-') {
      const erpItem = await this.stgItemRepo.findOne({ where: { erpItemCode: body.erpItemCode } });
      if (erpItem) desc = erpItem.erpItemDesc;
    }

    const spec = this.productSpecRepo.create({
      erpItemId: body.erpItemId,
      erpItemCode: body.erpItemCode,
      erpItemDesc: desc,
      erpItemType: body.erpItemType,
      productType: body.productType,
      productSize: body.productSize,
      productYield: body.productYield,
      productWeight: body.productWeight,
      productSpeed: body.productSpeed,
      productLead: body.productLead,
    });

    const saved = await this.productSpecRepo.save(spec);
    return { success: true, data: saved };
  }

  // ─── Update an existing product spec ───
  @Put(':id')
  async update(@Param('id') id: number, @Body() body: {
    productType?: string;
    productSize?: string;
    productYield?: number;
    productWeight?: number;
    productSpeed?: number;
    productLead?: number;
  }) {
    const spec = await this.productSpecRepo.findOne({ where: { id } });
    if (!spec) {
      return { success: false, message: 'Product spec not found' };
    }

    // Only update editable fields (not ERP data)
    if (body.productType !== undefined) spec.productType = body.productType;
    if (body.productSize !== undefined) spec.productSize = body.productSize;
    if (body.productYield !== undefined) spec.productYield = body.productYield;
    if (body.productWeight !== undefined) spec.productWeight = body.productWeight;
    if (body.productSpeed !== undefined) spec.productSpeed = body.productSpeed;
    if (body.productLead !== undefined) spec.productLead = body.productLead;

    const saved = await this.productSpecRepo.save(spec);
    return { success: true, data: saved };
  }

  // ─── Bulk create specs from multiple ERP items ───
  @Post('bulk')
  async bulkCreate(@Body() body: {
    items: Array<{
      erpItemId: number;
      erpItemCode: string;
      erpItemDesc: string;
      erpItemType: string;
    }>;
    productType: string;
    productSize: string;
    productYield: number;
    productWeight: number;
    productSpeed: number;
    productLead: number;
  }) {
    const results = [];
    for (const item of body.items) {
      const existing = await this.productSpecRepo.findOne({
        where: { erpItemCode: item.erpItemCode },
      });
      if (existing) {
        results.push({ itemCode: item.erpItemCode, status: 'skipped', message: 'Already exists' });
        continue;
      }

      // Fetch description from StgErpItem if missing
      let desc = item.erpItemDesc;
      if (!desc || desc === '-') {
        const erpItem = await this.stgItemRepo.findOne({ where: { erpItemCode: item.erpItemCode } });
        if (erpItem) desc = erpItem.erpItemDesc;
      }

      const spec = this.productSpecRepo.create({
        erpItemId: item.erpItemId,
        erpItemCode: item.erpItemCode,
        erpItemDesc: desc,
        erpItemType: item.erpItemType,
        productType: body.productType,
        productSize: body.productSize,
        productYield: body.productYield,
        productWeight: body.productWeight,
        productSpeed: body.productSpeed,
        productLead: body.productLead,
      });

      const saved = await this.productSpecRepo.save(spec);
      results.push({ itemCode: item.erpItemCode, status: 'created', data: saved });
    }
    return { success: true, results };
  }

  // ─── Import from Excel ───
  @Post('import-excel')
  async importExcel(@Body() body: {
    rows: Array<{
      erpItemCode: string;
      productType?: string;
      productSize?: string;
      productYield?: number;
      productWeight?: number;
      productSpeed?: number;
      productLead?: number;
    }>
  }) {
    const results: any[] = [];
    for (const row of body.rows) {
      if (!row.erpItemCode) {
        results.push({ itemCode: '(empty)', status: 'skipped', message: 'No item code' });
        continue;
      }

      const existing = await this.productSpecRepo.findOne({
        where: { erpItemCode: row.erpItemCode },
      });

      if (existing) {
        // Update existing spec
        if (row.productType !== undefined) existing.productType = row.productType;
        if (row.productSize !== undefined) existing.productSize = row.productSize;
        if (row.productYield !== undefined) existing.productYield = row.productYield;
        if (row.productWeight !== undefined) existing.productWeight = row.productWeight;
        if (row.productSpeed !== undefined) existing.productSpeed = row.productSpeed;
        if (row.productLead !== undefined) existing.productLead = row.productLead;
        await this.productSpecRepo.save(existing);
        results.push({ itemCode: row.erpItemCode, status: 'updated' });
      } else {
        // Create new spec — try to get desc from ERP
        const erpItem = await this.stgItemRepo.findOne({ where: { erpItemCode: row.erpItemCode } });
        const spec = this.productSpecRepo.create({
          erpItemId: erpItem?.erpItemId || undefined,
          erpItemCode: row.erpItemCode,
          erpItemDesc: erpItem?.erpItemDesc || undefined,
          erpItemType: erpItem?.erpItemType || undefined,
          productType: row.productType || 'chilled',
          productSize: row.productSize || 'unsize',
          productYield: row.productYield ?? 0.84,
          productWeight: row.productWeight ?? 2,
          productSpeed: row.productSpeed ?? 45,
          productLead: row.productLead ?? (row.productType === 'freeze' ? 5 : 1),
        });
        await this.productSpecRepo.save(spec);
        results.push({ itemCode: row.erpItemCode, status: 'created' });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    return { success: true, summary: { created, updated, skipped, total: body.rows.length }, results };
  }

  @Post('assign-yield')
  async assignMasterYield(@Body() body: { specIds: number[], masterYieldId: string | null }) {
    if (!body.specIds || body.specIds.length === 0) return { success: true };
    
    // Fetch all specs to update
    const specs = await this.productSpecRepo.findByIds(body.specIds);
    
    for (const spec of specs) {
      if (body.masterYieldId === null) {
        // If masterYieldId is null, the UI wants to clear ALL yield mappings for these specs?
        // Wait, the UI passes `masterYieldId: null` when deleting a spec from the UI.
        // Actually, the UI passes `{ specIds: [specId], masterYieldId: null }` but we need to know WHICH masterYieldId to remove!
        // Right now it clears everything. Let's keep it clearing everything unless we change the UI.
        spec.masterYieldIds = null;
      } else {
        const ids = spec.masterYieldIds ? spec.masterYieldIds.split(',').map(id => id.trim()).filter(id => id) : [];
        if (!ids.includes(body.masterYieldId)) {
          ids.push(body.masterYieldId);
        }
        spec.masterYieldIds = ids.join(',');
      }
    }
    
    await this.productSpecRepo.save(specs);
    return { success: true };
  }

  @Post('unassign-yield')
  async unassignMasterYield(@Body() body: { specIds: number[], masterYieldId: string }) {
    if (!body.specIds || body.specIds.length === 0 || !body.masterYieldId) return { success: true };
    
    const specs = await this.productSpecRepo.findByIds(body.specIds);
    for (const spec of specs) {
      if (spec.masterYieldIds) {
        const ids = spec.masterYieldIds.split(',').map(id => id.trim()).filter(id => id && id !== body.masterYieldId);
        spec.masterYieldIds = ids.length > 0 ? ids.join(',') : null;
      }
    }
    await this.productSpecRepo.save(specs);
    return { success: true };
  }
}
