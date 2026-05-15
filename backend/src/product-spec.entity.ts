import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_specs')
export class ProductSpec {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── ERP Data (read-only from stg_erp_items) ───
  @Column({ name: 'ERP_ITEM_ID', type: 'int', nullable: true })
  erpItemId: number;

  @Column({ name: 'ERP_ITEM_CODE', type: 'varchar', length: 100, unique: true })
  erpItemCode: string;

  @Column({ name: 'ERP_ITEM_DESC', type: 'nvarchar', length: 255, nullable: true })
  erpItemDesc: string;

  @Column({ name: 'ERP_ITEM_TYPE', type: 'varchar', length: 50, nullable: true })
  erpItemType: string;

  // ─── Product Spec Data (editable) ───
  @Column({ name: 'PRODUCT_TYPE', type: 'varchar', length: 20, nullable: true })
  productType: string; // 'chilled' or 'freeze'

  @Column({ name: 'PRODUCT_SIZE', type: 'varchar', length: 50, nullable: true })
  productSize: string; // '50-65', 'unsize', '40 Down', '60 Up'

  @Column({ name: 'PRODUCT_YIELD', type: 'decimal', precision: 10, scale: 4, nullable: true })
  productYield: number;

  @Column({ name: 'PRODUCT_WEIGHT', type: 'decimal', precision: 10, scale: 4, nullable: true })
  productWeight: number;

  @Column({ name: 'PRODUCT_SPEED', type: 'decimal', precision: 10, scale: 2, nullable: true })
  productSpeed: number;

  @Column({ name: 'PRODUCT_LEAD', type: 'int', nullable: true })
  productLead: number; // Default: chilled=1, freeze=5

  @Column({ name: 'MASTER_YIELD_IDS', type: 'varchar', length: 1000, nullable: true })
  masterYieldIds: string | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
