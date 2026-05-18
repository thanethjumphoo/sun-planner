import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('chicken_receiving_weekly_size')
@Unique(['receiveDate', 'groupSize', 'partName'])
export class ChickenReceivingWeeklySize {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receive_date', type: 'date' })
  receiveDate: Date;

  @Column({ name: 'group_size', type: 'varchar', length: 50 })
  groupSize: string;

  @Column({ name: 'part_name', type: 'nvarchar', length: 100 })
  partName: string;

  @Column({ name: 'quantity_kg', type: 'int', default: 0 })
  quantityKg: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
