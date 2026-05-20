import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { MasterYield } from './master-yield.entity';

@Controller('api/master-yield')
export class MasterYieldController {
  constructor(
    @InjectRepository(MasterYield)
    private readonly masterYieldRepository: Repository<MasterYield>,
  ) {}

  @Get()
  async getTree() {
    return this.masterYieldRepository.find({
      relations: [
        'children',
        'children.children',
        'children.children.children',
      ],
      where: { parentId: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  @Post()
  async createNode(@Body() data: Partial<MasterYield>) {
    const node = this.masterYieldRepository.create(data);
    return this.masterYieldRepository.save(node);
  }

  @Put(':id')
  async updateNode(
    @Param('id') id: string,
    @Body() data: Partial<MasterYield>,
  ) {
    await this.masterYieldRepository.update(id, data);
    return this.masterYieldRepository.findOne({ where: { id } });
  }

  @Delete(':id')
  async deleteNode(@Param('id') id: string) {
    // Delete cascade is somewhat tricky in MS SQL without proper constraints.
    // Let's delete it manually for simplicity if it has children, or just use delete.
    const node = await this.masterYieldRepository.findOne({
      where: { id },
      relations: ['children', 'children.children'],
    });
    if (!node) return { success: false };

    // simple recursive delete for up to 3 levels
    if (node.children) {
      for (const child of node.children) {
        if (child.children) {
          for (const grandchild of child.children) {
            await this.masterYieldRepository.delete(grandchild.id);
          }
        }
        await this.masterYieldRepository.delete(child.id);
      }
    }

    await this.masterYieldRepository.delete(id);
    return { success: true };
  }
}
