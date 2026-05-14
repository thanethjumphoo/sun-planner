import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { MpsPlan } from './mps-plan.entity';
import { MpsPlanSupplySize } from './mps-plan-supply-size.entity';

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

  // Size breakdown is now stored in mps_plan_supply_size table
  @OneToMany(() => MpsPlanSupplySize, size => size.mpsPlanSupply, { cascade: true })
  sizes: MpsPlanSupplySize[];
}
