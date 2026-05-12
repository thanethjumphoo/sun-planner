import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { MpsPlan } from './mps-plan.entity';

// ─── 1. DPS Plan Header (หัวตารางแผนผลิตรายวัน) ───
@Entity('dps_plans')
export class DpsPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'production_date', type: 'date' })
  productionDate: Date;

  // Link กลับไปยังแผน MPS ที่ถูกนำมาใช้ (ต้องเป็น status = APPROVED)
  @ManyToOne(() => MpsPlan, { nullable: true })
  @JoinColumn({ name: 'mps_plan_id' })
  mpsPlan: MpsPlan;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' })
  status: string; // DRAFT, CONFIRMED, COMPLETED

  @Column({ name: 'total_supply_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalSupplyKg: number;

  @Column({ name: 'total_demand_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalDemandKg: number;

  @Column({ name: 'fulfillment_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  fulfillmentRate: number; // %

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DpsSublot, sublot => sublot.dpsPlan, { cascade: true })
  sublots: DpsSublot[];

  @OneToMany(() => DpsOrder, order => order.dpsPlan, { cascade: true })
  orders: DpsOrder[];

  @OneToMany(() => DpsAllocation, alloc => alloc.dpsPlan, { cascade: true })
  allocations: DpsAllocation[];
}

// ─── 2. DPS Sublot (ข้อมูลฟาร์ม/ลอตไก่เข้า - Supply Side) ───
@Entity('dps_sublots')
export class DpsSublot {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DpsPlan, plan => plan.sublots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dps_plan_id' })
  dpsPlan: DpsPlan;

  @Column({ name: 'sublot_number', type: 'varchar', length: 50 })
  sublotNumber: string; // เช่น SL-1

  @Column({ name: 'farm_name', type: 'varchar', length: 255 })
  farmName: string;

  @Column({ name: 'total_birds', type: 'int' })
  totalBirds: number;

  @Column({ name: 'shift', type: 'varchar', length: 20, default: 'A' })
  shift: string;

  @Column({ name: 'total_weight_kg', type: 'decimal', precision: 18, scale: 2 })
  totalWeightKg: number;

  @Column({ name: 'avg_live_weight', type: 'decimal', precision: 10, scale: 4 })
  avgLiveWeight: number;

  @Column({ name: 'co_product_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  coProductKg: number; // น้ำหนัก Grade B ที่กระจายมา

  @OneToMany(() => DpsSublotBin, bin => bin.sublot, { cascade: true })
  bins: DpsSublotBin[];
}

// ─── 3. DPS Sublot Bins (กล่องกระจาย Size ของแต่ละ Sublot) ───
@Entity('dps_sublot_bins')
export class DpsSublotBin {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DpsSublot, sublot => sublot.bins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dps_sublot_id' })
  sublot: DpsSublot;

  @Column({ name: 'size_label', type: 'varchar', length: 50 })
  sizeLabel: string; // เช่น "40-45", "50 Up", "unsize"

  @Column({ name: 'available_kg', type: 'decimal', precision: 18, scale: 2 })
  availableKg: number; // น้ำหนักตั้งต้นในกล่องนี้
}

// ─── 4. DPS Orders (รายการความต้องการรายวัน - Demand Side) ───
@Entity('dps_orders')
export class DpsOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DpsPlan, plan => plan.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dps_plan_id' })
  dpsPlan: DpsPlan;

  @Column({ name: 'erp_order_line_id', type: 'int' })
  erpOrderLineId: number; // เชื่อมกลับไปออเดอร์ใน ERP/MPS ได้

  @Column({ name: 'item_code', type: 'varchar', length: 100 })
  itemCode: string;

  @Column({ name: 'item_desc', type: 'varchar', length: 255 })
  itemDesc: string;

  @Column({ name: 'product_type', type: 'varchar', length: 50 })
  productType: string;

  @Column({ name: 'product_size', type: 'varchar', length: 50 })
  productSize: string; // Size spec เช่น "40-45"

  @Column({ name: 'required_kg', type: 'decimal', precision: 18, scale: 2 })
  requiredKg: number; // ยอดเต็มที่ต้องการ

  @Column({ name: 'fulfilled_kg', type: 'decimal', precision: 18, scale: 2, default: 0 })
  fulfilledKg: number; // ยอดที่หาเนื้อมาเติมได้แล้ว

  @Column({ name: 'unfulfilled_kg', type: 'decimal', precision: 18, scale: 2 })
  unfulfilledKg: number; // ยอดที่ยังขาด
}

// ─── 5. DPS Allocations (บันทึกการจัดสรรเนื้อจาก Bin ไหน -> ไป Order ไหน) ───
@Entity('dps_allocations')
export class DpsAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DpsPlan, plan => plan.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dps_plan_id' })
  dpsPlan: DpsPlan;

  // เอาเนื้อมาจากไหน
  @ManyToOne(() => DpsSublotBin)
  @JoinColumn({ name: 'source_bin_id' })
  sourceBin: DpsSublotBin;

  // จ่ายให้ออเดอร์ไหน
  @ManyToOne(() => DpsOrder)
  @JoinColumn({ name: 'target_order_id' })
  targetOrder: DpsOrder;

  @Column({ name: 'allocated_kg', type: 'decimal', precision: 18, scale: 2 })
  allocatedKg: number;

  @Column({ name: 'allocation_pass', type: 'varchar', length: 50 })
  allocationPass: string; // "Pass 0: Manual", "Pass 1: Exact", "Pass 2: Unsize", "Pass 3: Co-product"
}
