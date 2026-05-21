import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MachineConfig } from './machine-config.entity';

@Controller('api/machine-config')
export class MachineConfigController {
  constructor(
    @InjectRepository(MachineConfig)
    private readonly configRepo: Repository<MachineConfig>,
  ) {}

  @Get()
  async getAllConfigs() {
    return this.configRepo.find({ order: { id: 'ASC' } });
  }

  @Post('seed')
  async seedInitialData() {
    const defaultConfigs = [
      {
        machineKey: 'toridas',
        machineName: 'Toridas Machine',
        machineType: 'DEBONE',
        capacityPcsPerHour: 1500,
        yieldPercentage: 0.75,
        defaultLines: 3,
        machinesPerLine: 4,
        workersPerUnit: 5,
        isActive: true,
      },
      {
        machineKey: 'foodmate',
        machineName: 'Foodmate Machine',
        machineType: 'DEBONE',
        capacityPcsPerHour: 6000,
        yieldPercentage: 0.70,
        defaultLines: 1,
        machinesPerLine: 1,
        workersPerUnit: 5,
        isActive: true,
      },
      {
        machineKey: 'trimming_belt',
        machineName: 'Trimming Belt',
        machineType: 'TRIMMING',
        capacityPcsPerHour: 600, // 10 pcs/min = 600 pcs/hr
        yieldPercentage: 1.0,
        defaultLines: 3, // 3 belts
        machinesPerLine: 1,
        workersPerUnit: 7, // Fixed workers per belt
        isActive: true,
      },
      {
        machineKey: 'xray',
        machineName: 'X-Ray Machine',
        machineType: 'XRAY',
        capacityPcsPerHour: 18700,
        yieldPercentage: 1.0,
        defaultLines: 3, // Max 3 machines
        machinesPerLine: 1,
        workersPerUnit: 5, // 5 pax per machine
        isActive: true,
      }
    ];

    let addedCount = 0;
    for (const conf of defaultConfigs) {
      const exists = await this.configRepo.findOne({ where: { machineKey: conf.machineKey } });
      if (!exists) {
        await this.configRepo.save(this.configRepo.create(conf));
        addedCount++;
      }
    }
    return { success: true, message: `Seeded ${addedCount} machine configs.` };
  }

  @Post(':id/update')
  async updateConfig(@Param('id') id: number, @Body() body: any) {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) return { success: false, message: 'Config not found' };

    if (body.capacityPcsPerHour !== undefined) config.capacityPcsPerHour = Number(body.capacityPcsPerHour);
    if (body.yieldPercentage !== undefined) config.yieldPercentage = Number(body.yieldPercentage);
    if (body.defaultLines !== undefined) config.defaultLines = Number(body.defaultLines);
    if (body.machinesPerLine !== undefined) config.machinesPerLine = Number(body.machinesPerLine);
    if (body.workersPerUnit !== undefined) config.workersPerUnit = Number(body.workersPerUnit);
    if (body.isActive !== undefined) config.isActive = Boolean(body.isActive);

    await this.configRepo.save(config);
    return { success: true, data: config };
  }
}
