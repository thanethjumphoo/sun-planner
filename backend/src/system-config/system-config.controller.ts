import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';

@Controller('api/system-config')
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get()
  async getAll() {
    return this.configService.getAllConfigs();
  }

  @Get(':key')
  async getByKey(@Param('key') key: string) {
    const value = await this.configService.getConfig(key);
    return { key, value };
  }

  @Put(':key')
  async update(@Param('key') key: string, @Body() body: { value: string }) {
    return this.configService.updateConfig(key, body.value);
  }
}
