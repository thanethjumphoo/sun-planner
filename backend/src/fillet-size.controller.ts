import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilletConfig, FilletGroup, FilletSizeCalc } from './fillet-size.entity';

@Controller('api/fillet-size')
export class FilletSizeController {
  constructor(
    @InjectRepository(FilletConfig)
    private configRepo: Repository<FilletConfig>,
    @InjectRepository(FilletGroup)
    private groupRepo: Repository<FilletGroup>,
    @InjectRepository(FilletSizeCalc)
    private calcRepo: Repository<FilletSizeCalc>,
  ) {}

  // ─── Get all fillet data (yield + groups + saved calcs) ───
  @Get()
  async getAll() {
    const configs = await this.configRepo.find();
    const groups = await this.groupRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const calcs = await this.calcRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });

    // Extract fillet yield from config
    const yieldConfig = configs.find(c => c.configKey === 'fillet_yield');
    const filletYield = yieldConfig ? Number(yieldConfig.configValue) : 0.42;

    return {
      filletYield,
      groups: groups.map(g => ({
        id: g.id,
        name: g.groupName,
        sortOrder: g.sortOrder,
      })),
      calcs: calcs.map(c => ({
        id: c.id,
        colLabel: c.colLabel,
        lbWeight: Number(c.lbWeight),
        filletSize: c.filletSize,
        groupName: c.groupName,
        sortOrder: c.sortOrder,
      })),
    };
  }

  // ─── Save fillet yield ───
  @Post('yield')
  async saveYield(@Body() body: { filletYield: number }) {
    let config = await this.configRepo.findOne({ where: { configKey: 'fillet_yield' } });
    if (config) {
      config.configValue = body.filletYield;
    } else {
      config = this.configRepo.create({ configKey: 'fillet_yield', configValue: body.filletYield });
    }
    await this.configRepo.save(config);
    return { success: true, filletYield: Number(config.configValue) };
  }

  // ─── Bulk save fillet size calculations ───
  @Post('calc/save')
  async saveCalc(@Body() body: {
    items: { colLabel: string; lbWeight: number; filletSize: number; groupName: string | null }[];
  }) {
    await this.calcRepo.clear();
    const entities = body.items.map((item, idx) =>
      this.calcRepo.create({
        colLabel: item.colLabel,
        lbWeight: item.lbWeight,
        filletSize: item.filletSize,
        groupName: item.groupName,
        sortOrder: idx,
      }),
    );
    const saved = await this.calcRepo.save(entities, { chunk: 100 });
    return { success: true, count: saved.length };
  }

  // ─── Add a fillet group ───
  @Post('groups')
  async addGroup(@Body() body: { name: string }) {
    const maxOrder = await this.groupRepo
      .createQueryBuilder('g')
      .select('MAX(g.sortOrder)', 'maxOrder')
      .getRawOne();
    const sortOrder = (maxOrder?.maxOrder ?? 0) + 1;

    const group = this.groupRepo.create({
      groupName: body.name,
      sortOrder,
    });
    const saved = await this.groupRepo.save(group);
    return {
      success: true,
      group: { id: saved.id, name: saved.groupName, sortOrder: saved.sortOrder },
    };
  }

  // ─── Update a fillet group ───
  @Post('groups/:id')
  async updateGroup(@Param('id') id: number, @Body() body: { name: string }) {
    const group = await this.groupRepo.findOneBy({ id });
    if (group) {
      group.groupName = body.name;
      await this.groupRepo.save(group);
    }
    return { success: true };
  }

  // ─── Delete a fillet group ───
  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: number) {
    await this.groupRepo.delete(id);
    return { success: true };
  }

  // ─── Bulk save groups (replace all) ───
  @Post('groups/bulk-save')
  async bulkSaveGroups(@Body() body: { groups: { name: string }[] }) {
    await this.groupRepo.clear();
    const entities = body.groups.map((g, idx) =>
      this.groupRepo.create({ groupName: g.name, sortOrder: idx }),
    );
    const saved = await this.groupRepo.save(entities, { chunk: 100 });
    return { success: true, count: saved.length };
  }
}
