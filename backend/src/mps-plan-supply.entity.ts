import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MpsPlan } from './mps-plan.entity';

@Entity('mps_plan_supply')
export class MpsPlanSupply {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MpsPlan, plan => plan.supplyBreakdown, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mps_plan_id' })
  mpsPlan: MpsPlan;

  @Column({ name: 'mps_plan_id' })
  mpsPlanId: number;

  @Column({ name: 'production_date', type: 'date' })
  productionDate: Date;

  @Column({ name: 'intake_birds', type: 'int', default: 0 })
  intakeBirds: number;

  @Column({ name: 'total_weight', type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalWeight: number;

  @Column({ name: 'avg_weight', type: 'decimal', precision: 18, scale: 3, default: 0 })
  avgWeight: number;

  @Column({ name: 'slaughtered_weight', type: 'decimal', precision: 18, scale: 2, default: 0 })
  slaughteredWeight: number;

  // Size Bins for Fillet (สันใน)
  @Column({ name: 'size_40_down', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size40Down: number;

  @Column({ name: 'size_40_45', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size40_45: number;

  @Column({ name: 'size_45_50', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size45_50: number;

  @Column({ name: 'size_50_55', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size50_55: number;

  @Column({ name: 'size_55_60', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size55_60: number;

  @Column({ name: 'size_60_65', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size60_65: number;

  @Column({ name: 'size_65_70', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size65_70: number;

  @Column({ name: 'size_70_up', type: 'decimal', precision: 18, scale: 2, default: 0 })
  size70_up: number;
}
