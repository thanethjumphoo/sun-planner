import { Controller, Get, Post, Body, Param, ParseIntPipe, Put, Delete } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalRmSupply } from './external-rm-supply.entity';

@Controller('api/external-rm-supplies')
export class ExternalRmSupplyController {
  constructor(
    @InjectRepository(ExternalRmSupply)
    private readonly rmSupplyRepo: Repository<ExternalRmSupply>,
  ) {}

  @Get()
  async getAll() {
    const data = await this.rmSupplyRepo.find({ order: { receivedDate: 'DESC' } });
    return { success: true, data };
  }

  @Post()
  async create(@Body() dto: any) {
    const supply = this.rmSupplyRepo.create(dto);
    const saved = await this.rmSupplyRepo.save(supply);
    return { success: true, data: saved };
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    await this.rmSupplyRepo.update(id, dto);
    const updated = await this.rmSupplyRepo.findOne({ where: { id } });
    return { success: true, data: updated };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.rmSupplyRepo.delete(id);
    return { success: true };
  }
}
