import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MpsPlanSupply } from './mps-plan-supply.entity';

@Entity('mps_plan_supply_size')
export class MpsPlanSupplySize {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MpsPlanSupply, supply => supply.sizes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mps_plan_supply_id' })
  mpsPlanSupply: MpsPlanSupply;

  @Column({ name: 'mps_plan_supply_id' })
  mpsPlanSupplyId: number;

  @Column({ name: 'group_size', type: 'varchar', length: 50 })
  groupSize: string; // e.g. "40 Down", "40-45", "45-50", "50-55", "55-60", "60-65", "65-70", "70 Up"

  @Column({ name: 'part_name', type: 'nvarchar', length: 100 })
  partName: string; // e.g. "สันใน", "BIL L/C"

  @Column({ name: 'quantity_kg', type: 'int', default: 0 })
  quantityKg: number; // ปริมาณเป็น kg (จำนวนเต็ม)

  @Column({ name: 'production_date', type: 'date' })
  productionDate: Date; // วันที่ MPS (ซ้ำกับ parent แต่เก็บไว้ query ง่าย)
}
