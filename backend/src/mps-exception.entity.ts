import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MpsPlan } from './mps-plan.entity';

@Entity('mps_exception_reports')
export class MpsExceptionReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MpsPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mps_plan_id' })
  mpsPlan: MpsPlan;

  @Column({ name: 'erp_order_line_id', type: 'int', nullable: true })
  erpOrderLineId: number;

  @Column({ name: 'so_number', type: 'varchar', length: 100, nullable: true })
  soNumber: string;

  @Column({ name: 'item_code', type: 'varchar', length: 100 })
  itemCode: string;

  @Column({ name: 'ship_date', type: 'date' })
  shipDate: Date;

  @Column({ name: 'required_kg', type: 'decimal', precision: 18, scale: 2 })
  requiredKg: number;

  @Column({ name: 'shortage_kg', type: 'decimal', precision: 18, scale: 2 })
  shortageKg: number;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
