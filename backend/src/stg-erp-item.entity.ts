import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stg_erp_items')
export class StgErpItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ERP_ITEM_ID', type: 'int', nullable: true })
  erpItemId: number;

  @Column({ name: 'ERP_ORG_ID', type: 'int', nullable: true })
  erpOrgId: number;

  @Column({ name: 'ERP_ITEM_TYPE', type: 'varchar', length: 50, nullable: true })
  erpItemType: string;

  @Column({ name: 'ERP_ITEM_CODE', type: 'varchar', length: 100, nullable: true })
  erpItemCode: string;

  @Column({ name: 'ERP_ITEM_DESC', type: 'varchar', length: 255, nullable: true })
  erpItemDesc: string;

  @Column({ name: 'ERP_ITEM_UOM', type: 'varchar', length: 20, nullable: true })
  erpItemUom: string;

  @Column({ name: 'ERP_CREATION_DATE', type: 'datetime', nullable: true })
  erpCreationDate: Date;

  @Column({ name: 'ERP_LAST_UPDATE_DATE', type: 'datetime', nullable: true })
  erpLastUpdateDate: Date;

  @Column({ name: 'ERP_ENABLED_FLAG', type: 'varchar', length: 1, nullable: true })
  erpEnabledFlag: string;
}
