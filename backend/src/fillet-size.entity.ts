import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fillet_config')
export class FilletConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'CONFIG_KEY', type: 'varchar', length: 50, unique: true })
  configKey: string;

  @Column({ name: 'CONFIG_VALUE', type: 'decimal', precision: 10, scale: 6, default: 0 })
  configValue: number;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}

@Entity('fillet_groups')
export class FilletGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'GROUP_NAME', type: 'varchar', length: 100 })
  groupName: string;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}

@Entity('fillet_size_calc')
export class FilletSizeCalc {
  @PrimaryGeneratedColumn()
  id: number;

  // Column label from Weight Distribution (Chicken C Weight)
  @Column({ name: 'COL_LABEL', type: 'varchar', length: 50 })
  colLabel: string;

  // LB Weight = colValue / 80%
  @Column({ name: 'LB_WEIGHT', type: 'decimal', precision: 10, scale: 4, default: 0 })
  lbWeight: number;

  // Fillet Size = (yield * lbWeight * 1000) / 2, stored as integer
  @Column({ name: 'FILLET_SIZE', type: 'int', default: 0 })
  filletSize: number;

  // Assigned group name (nullable)
  @Column({ name: 'GROUP_NAME', type: 'varchar', length: 100, nullable: true })
  groupName: string | null;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
