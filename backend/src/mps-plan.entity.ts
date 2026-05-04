import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

// ─── 1. MPS Plan Header (หัวตารางแผนการผลิต) ───
@Entity('mps_plans')
export class MpsPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_name', type: 'varchar', length: 100 })
  planName: string; // เช่น "MPS May 2026 - V1"

  @Column({ name: 'target_month', type: 'varchar', length: 7 })
  targetMonth: string; // "YYYY-MM" (เช่น "2026-05")

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' })
  status: string; // DRAFT, FROZEN, APPROVED, CANCELLED

  // ภาพรวมทั้งหมดของแผน ณ ตอนที่ Generate (ป้องกันตัวเลขเปลี่ยนเมื่อ Master Data เปลี่ยน)
  @Column({ name: 'total_intake_birds', type: 'int', default: 0 })
  totalIntakeBirds: number;

  @Column({ name: 'total_rm_fl_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalRmFlKg: number;

  @Column({ name: 'total_demand_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalDemandKg: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MpsPlanDaily, daily => daily.mpsPlan, { cascade: true })
  dailySummaries: MpsPlanDaily[];

  @OneToMany(() => MpsPlanOrder, order => order.mpsPlan, { cascade: true })
  orders: MpsPlanOrder[];
}

// ─── 2. MPS Plan Daily Summary (สรุปตัวเลขรายวันของแผนนั้น) ───
@Entity('mps_plan_daily')
export class MpsPlanDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MpsPlan, plan => plan.dailySummaries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mps_plan_id' })
  mpsPlan: MpsPlan;

  @Column({ name: 'production_date', type: 'date' })
  productionDate: Date;

  // Snapshot ของ Supply & Demand ในแต่ละวัน
  @Column({ name: 'intake_birds', type: 'int', default: 0 })
  intakeBirds: number;

  @Column({ name: 'rm_fl_avail_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  rmFlAvailKg: number;

  @Column({ name: 'demand_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  demandKg: number;

  @Column({ name: 'cutting_staff', type: 'int', default: 0 })
  cuttingStaff: number;

  @Column({ name: 'support_staff', type: 'int', default: 0 })
  supportStaff: number;

  @Column({ name: 'total_staff', type: 'int', default: 0 })
  totalStaff: number;
}

// ─── 3. MPS Plan Orders (เก็บ Snapshot การจัดสรร Order เข้าสู่วันผลิต) ───
@Entity('mps_plan_orders')
export class MpsPlanOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => MpsPlan, plan => plan.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mps_plan_id' })
  mpsPlan: MpsPlan;

  @Column({ name: 'erp_order_line_id', type: 'int' })
  erpOrderLineId: number;

  @Column({ name: 'item_code', type: 'varchar', length: 100 })
  itemCode: string;

  @Column({ name: 'item_desc', type: 'varchar', length: 255 })
  itemDesc: string;

  @Column({ name: 'product_type', type: 'varchar', length: 50 })
  productType: string; // CHILLED, FREEZE (Snapshot ค่ามาจาก Spec ณ ตอนนั้น)

  @Column({ name: 'quantity_kg', type: 'decimal', precision: 18, scale: 2 })
  quantityKg: number;

  // วันส่งสินค้าดั้งเดิม
  @Column({ name: 'ship_date', type: 'date' })
  shipDate: Date;

  // วันที่ระบบ/คนจัดสรรให้ผลิต (Planned Production Date)
  @Column({ name: 'planned_production_date', type: 'date' })
  plannedProductionDate: Date;

  @Column({ name: 'is_manual_override', type: 'bit', default: 0 })
  isManualOverride: boolean; // ให้รู้ว่าอันนี้คนลากย้ายเอง ไม่ได้มาจากการ Auto
}
