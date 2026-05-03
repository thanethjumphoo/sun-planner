import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('chicken_receiving_plan_weekly')
export class ChickenReceivingPlanWeekly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  receive_date: Date;

  @Column({ type: 'time', nullable: true })
  receive_time: string;

  @Column()
  chicken_type: string;

  @Column({ type: 'int' })
  chicken_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  chicken_weight: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  chicken_avg: number;

  @Column()
  farm_name: string;

  @Column({ nullable: true })
  farm_name_standard: string;

  @Column({ nullable: true })
  house: string;

  @Column({ nullable: true })
  health: string;

  @Column({ nullable: true })
  shift: string;

  @Column({ nullable: true })
  sex: string;

  @Column({ nullable: true })
  batch: string;

  @CreateDateColumn()
  createAt: Date;

  @UpdateDateColumn()
  updateAt: Date;
}
