import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ChickenReceivingService } from './chicken-receiving.service';

@Controller('chicken-receiving')
export class ChickenReceivingController {
  constructor(private readonly chickenReceivingService: ChickenReceivingService) {}

  @Post(':type/batch')
  createBatch(@Param('type') type: string, @Body() data: { rows: any[] }) {
    return this.chickenReceivingService.createBatch(type, data.rows);
  }

  @Post(':type')
  create(@Param('type') type: string, @Body() data: any) {
    return this.chickenReceivingService.create(type, data);
  }

  @Get(':type')
  findAll(@Param('type') type: string) {
    return this.chickenReceivingService.findAll(type);
  }

  @Put(':type/:id')
  update(@Param('type') type: string, @Param('id') id: string, @Body() data: any) {
    return this.chickenReceivingService.update(type, id, data);
  }

  @Delete(':type/:id')
  remove(@Param('type') type: string, @Param('id') id: string) {
    return this.chickenReceivingService.remove(type, id);
  }
}
