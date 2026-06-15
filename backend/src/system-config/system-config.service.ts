import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';
import { MPS_CONSTANTS } from '../constants/mps.constants';

@Injectable()
export class SystemConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    const defaults = [
      { key: 'DEFAULT_MAX_LEAD_DAYS', value: MPS_CONSTANTS.DEFAULTS.MAX_LEAD_DAYS.toString(), type: 'number', desc: 'Max fallback lead time for specs without it.' },
      { key: 'CHILLED_OFFSET_DAYS', value: MPS_CONSTANTS.DEFAULTS.CHILLED_OFFSET_DAYS.toString(), type: 'number', desc: 'Days to subtract for chilled auto-allocation.' },
      { key: 'FREEZE_OFFSET_DAYS', value: MPS_CONSTANTS.DEFAULTS.FREEZE_OFFSET_DAYS.toString(), type: 'number', desc: 'Days to subtract for freeze auto-allocation.' },
      { key: 'FREEZE_PROD_ADD_DAYS', value: MPS_CONSTANTS.DEFAULTS.FREEZE_PROD_ADD_DAYS.toString(), type: 'number', desc: 'Days to add for freeze finished production date.' },
      { key: 'DEFAULT_BIL_YIELD', value: MPS_CONSTANTS.DEFAULTS.BIL_YIELD.toString(), type: 'number', desc: 'Fallback yield for BIL calculation.' },
      { key: 'FILLET_GRADE_B_WASTE_MULTIPLIER', value: MPS_CONSTANTS.DEFAULTS.FILLET_GRADE_B_WASTE_MULTIPLIER.toString(), type: 'number', desc: 'Multiplier to compensate Grade B waste for Net Fillet.' },
    ];

    for (const item of defaults) {
      const exists = await this.configRepo.findOne({ where: { configKey: item.key } });
      if (!exists) {
        await this.configRepo.save(this.configRepo.create({
          configKey: item.key,
          configValue: item.value,
          dataType: item.type,
          description: item.desc,
        }));
      }
    }
  }

  async getAllConfigs() {
    return this.configRepo.find();
  }

  async getConfig(key: string): Promise<string | null> {
    const config = await this.configRepo.findOne({ where: { configKey: key } });
    return config ? config.configValue : null;
  }
  
  async getNumberConfig(key: string, fallback: number): Promise<number> {
    const val = await this.getConfig(key);
    if (val === null) return fallback;
    const parsed = Number(val);
    return isNaN(parsed) ? fallback : parsed;
  }

  async updateConfig(key: string, value: string) {
    let config = await this.configRepo.findOne({ where: { configKey: key } });
    if (config) {
      config.configValue = value;
    } else {
      config = this.configRepo.create({ configKey: key, configValue: value });
    }
    return this.configRepo.save(config);
  }
}
