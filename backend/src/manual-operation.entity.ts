import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('manual_operations')
@Unique(['productionDate', 'partType'])
export class ManualOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'production_date', type: 'date' })
  productionDate: Date;

  @Column({ name: 'part_type', type: 'varchar', length: 50, default: 'fillet' })
  partType: string;

  @Column({ name: 'planned_station_workers', type: 'int', default: 0 })
  plannedStationWorkers: number;

  @Column({ name: 'actual_station_workers', type: 'int', default: 0 })
  actualStationWorkers: number;

  @Column({ name: 'actual_cutting_workers', type: 'int', default: 0 })
  actualCuttingWorkers: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
