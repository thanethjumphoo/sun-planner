import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

@Entity('master_yield')
export class MasterYield {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'nvarchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  yieldPercentage: number; 

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string;

  @ManyToOne(() => MasterYield, (yieldObj) => yieldObj.children, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'parentId' })
  parent: MasterYield;

  @OneToMany(() => MasterYield, (yieldObj) => yieldObj.parent)
  children: MasterYield[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
