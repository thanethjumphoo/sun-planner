import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('bil_weight_distributions')
export class BilWeightDistribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ROW_LABEL', type: 'varchar', length: 50 })
  rowLabel: string;

  @Column({ name: 'COL_LABEL', type: 'varchar', length: 50 })
  colLabel: string;

  @Column({ name: 'BL_COL_LABEL', type: 'varchar', length: 50, nullable: true })
  blColLabel: string;

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
