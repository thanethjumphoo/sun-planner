import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('manual_operations')
export class ManualOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'production_date', type: 'date', unique: true })
  productionDate: Date;

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
