import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BlMpsPlan } from './bl-mps-plan.entity';

@Entity('bl_mps_plan_dailies')
export class BlMpsPlanDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'bl_mps_plan_id' })
  blMpsPlanId: number;

  @ManyToOne(() => BlMpsPlan, plan => plan.dailyPlans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bl_mps_plan_id' })
  blPlan: BlMpsPlan;

  @Column({ name: 'plan_date', length: 10 }) // e.g. "2026-05-01"
  planDate: string;

  // Amount of BL received from Process 3 Debone today
  @Column({ name: 'rm_bl_kg', type: 'decimal', precision: 10, scale: 2, default: 0 })
  rmBlKg: number;

  @Column({ name: 'internal_rm_bl_kg', type: 'decimal', precision: 10, scale: 2, default: 0 })
  internalRmBlKg: number;

  @Column({ name: 'external_rm_bl_kg', type: 'decimal', precision: 10, scale: 2, default: 0 })
  externalRmBlKg: number;

  // JSON string storing the exact sizing breakdown of RM BL e.g. {"140-160": 5000, "160-180": 2000}
  @Column({ name: 'rm_bl_sizing_json', type: 'text', nullable: true })
  rmBlSizingJson: string;

  // JSON string for orders allocated to exact size matches
  @Column({ name: 'allocated_orders_json', type: 'text', nullable: true })
  allocatedOrdersJson: string;

  // JSON string for what is sent to I-CUT and resulting Co-Products
  @Column({ name: 'icut_allocation_json', type: 'text', nullable: true })
  icutAllocationJson: string;

  // I-CUT Manpower required (hours)
  @Column({ name: 'icut_manpower_hours', type: 'decimal', precision: 8, scale: 2, default: 0 })
  icutManpowerHours: number;
}
