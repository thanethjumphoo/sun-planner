import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { BlMpsPlanDaily } from './bl-mps-plan-daily.entity';

@Entity('bl_mps_plans')
export class BlMpsPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'parent_mps_plan_id' })
  parentMpsPlanId: number; // Link to main MpsPlan

  @Column({ name: 'plan_month', length: 7 }) // e.g. "2026-05"
  planMonth: string;

  @Column({ length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'total_rm_bl_kg', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalRmBlKg: number;

  @Column({ name: 'total_internal_rm_bl_kg', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalInternalRmBlKg: number;

  @Column({ name: 'total_external_rm_bl_kg', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalExternalRmBlKg: number;

  @Column({ name: 'total_demand_bl_kg', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDemandBlKg: number;

  @OneToMany(() => BlMpsPlanDaily, daily => daily.blPlan, { cascade: true })
  dailyPlans: BlMpsPlanDaily[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
