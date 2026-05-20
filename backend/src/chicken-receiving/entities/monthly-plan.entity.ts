import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chicken_receiving_plan_monthly')
export class ChickenReceivingPlanMonthly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  receive_date: Date;

  @Column()
  chicken_type: string;

  @Column({ type: 'int' })
  chicken_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  chicken_weight: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  chicken_avg: number;

  @CreateDateColumn()
  createAt: Date;

  @UpdateDateColumn()
  updateAt: Date;
}
