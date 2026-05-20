import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('weight_distributions')
export class WeightDistribution {
  @PrimaryGeneratedColumn()
  id: number;

  // Row label (e.g. Live Weight value: "1.8", "1.9", "2.0", ...)
  @Column({ name: 'ROW_LABEL', type: 'varchar', length: 50 })
  rowLabel: string;

  // Column label (e.g. Product Size / Carcass Weight: "50-65", "40 Down", ...)
  @Column({ name: 'COL_LABEL', type: 'varchar', length: 50 })
  colLabel: string;

  // Distribution value as decimal (e.g. 0.36 = 36%)
  @Column({
    name: 'DIST_VALUE',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: 0,
  })
  distValue: number;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
