import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @PrimaryColumn({ name: 'config_key', length: 100 })
  configKey: string;

  @Column({ name: 'config_value', type: 'text' })
  configValue: string;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ name: 'data_type', type: 'varchar', length: 20, default: 'string' })
  dataType: string; // 'string', 'number', 'boolean', 'json'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
