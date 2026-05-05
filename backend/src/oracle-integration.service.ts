import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StgErpItem } from './stg-erp-item.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';

@Injectable()
export class OracleIntegrationService implements OnModuleDestroy {
  private connection: oracledb.Connection | null = null;

  constructor(
    @InjectRepository(StgErpItem)
    private stgErpItemRepository: Repository<StgErpItem>,
    @InjectRepository(StgErpOrderHeader)
    private stgErpOrderHeaderRepository: Repository<StgErpOrderHeader>,
    @InjectRepository(StgErpOrderLine)
    private stgErpOrderLineRepository: Repository<StgErpOrderLine>,
  ) {
    // เปิดใช้งาน Thick mode เพื่อรองรับ Oracle DB ที่ใช้ password verifier แบบเก่า
    try {
      oracledb.initOracleClient();
      console.log('✅ Oracle Client initialized in Thick mode');
    } catch (err: any) {
      if (err.message && !err.message.includes('already been initialized')) {
        console.error('Failed to initialize Oracle Client:', err.message);
      }
    }
  }

  /**
   * ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูล Oracle ERP
   */
  async connect(): Promise<oracledb.Connection> {
    if (this.connection) {
      return this.connection;
    }

    try {
      this.connection = await oracledb.getConnection({
        user: process.env.ORACLE_DB_USER || 'apps',
        password: process.env.ORACLE_DB_PASS || 'apps',
        // รูปแบบการต่อ Connect String: host:port/service_name
        connectString: `${process.env.ORACLE_DB_HOST || '172.25.10.12'}:${process.env.ORACLE_DB_PORT || '1522'}/${process.env.ORACLE_DB_SERVICE || 'PROD'}`,
      });
      console.log('Successfully connected to Oracle Database');
      return this.connection;
    } catch (err) {
      console.error('Oracle connection error:', err);
      throw err;
    }
  }

  /**
   * ตัวอย่างฟังก์ชันสำหรับดึงข้อมูล (SELECT)
   */
  async getSalesOrders(): Promise<any> {
    let conn;
    try {
      conn = await this.connect();

      // ตัวอย่างคำสั่ง SQL (เปลี่ยนชื่อ Table ให้ตรงกับของจริง เช่น OE_ORDER_HEADERS_ALL)
      const sql = `
        SELECT HEADER_ID, ORDER_NUMBER, ORDERED_DATE, FLOW_STATUS_CODE
        FROM OE_ORDER_HEADERS_ALL
        WHERE ROWNUM <= 10
        ORDER BY ORDERED_DATE DESC
      `;

      const result = await conn.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return result.rows; // คืนค่าข้อมูลออกมาเป็น Array ของ Object

    } catch (err) {
      console.error('Query execution error:', err);
      throw err;
    }
    // ไม่ควร close connection ในนี้ทันทีถ้ายังต้องการเรียกใช้ซ้ำ
  }

  /**
   * ดึงข้อมูล Item จาก Oracle ERP ตาม Item Code (SEGMENT1) หลายรายการ
   * @param itemCodes Array ของรหัสสินค้าที่ต้องการดึงจากหน้าเว็บ
   */
  async syncItems(itemCodes: string[]): Promise<any> {
    if (!itemCodes || itemCodes.length === 0) {
      return [];
    }

    let conn;
    try {
      conn = await this.connect();

      // สร้าง Bind Variables แบบไดนามิก สำหรับคำสั่ง IN (...)
      // เช่น :code0, :code1, :code2
      const bindNames = itemCodes.map((_, i) => `:code${i}`).join(', ');

      const savedItems = [];
      const chunkSize = 1000;

      for (let i = 0; i < itemCodes.length; i += chunkSize) {
        const chunk = itemCodes.slice(i, i + chunkSize);
        const bindNames = chunk.map((_, idx) => `:code${idx}`).join(', ');

        const sql = `
          SELECT ITM.INVENTORY_ITEM_ID AS ERP_ITEM_ID,
                 ITM.ORGANIZATION_ID   AS ERP_ORG_ID,
                 ITM.ITEM_TYPE         AS ERP_ITEM_TYPE,
                 ITM.SEGMENT1          AS ERP_ITEM_CODE,
                 ITM.DESCRIPTION       AS ERP_ITEM_DESC,
                 ITM.PRIMARY_UOM_CODE  AS ERP_ITEM_UOM,
                 ITM.CREATION_DATE     AS ERP_CREATION_DATE,
                 ITM.LAST_UPDATE_DATE  AS ERP_LAST_UPDATE_DATE,
                 ITM.ENABLED_FLAG      AS ERP_ENABLED_FLAG
          FROM  MTL_SYSTEM_ITEMS_B ITM
          WHERE ITM.SEGMENT1 IN (${bindNames})
          AND   ITM.ORGANIZATION_ID = 82
          AND   ITM.ENABLED_FLAG = 'Y'
        `;

        const binds: any = {};
        chunk.forEach((code, idx) => {
          binds[`code${idx}`] = code;
        });

        const result = await conn.execute(sql, binds, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });

        const erpRows: any[] = result.rows || [];

        for (const row of erpRows) {
          let item = await this.stgErpItemRepository.findOne({ 
            where: { erpItemCode: row.ERP_ITEM_CODE, erpOrgId: row.ERP_ORG_ID } 
          });

          if (!item) {
            item = this.stgErpItemRepository.create();
          }

          item.erpItemId = row.ERP_ITEM_ID;
          item.erpOrgId = row.ERP_ORG_ID;
          item.erpItemType = row.ERP_ITEM_TYPE;
          item.erpItemCode = row.ERP_ITEM_CODE;
          item.erpItemDesc = row.ERP_ITEM_DESC;
          item.erpItemUom = row.ERP_ITEM_UOM;
          item.erpCreationDate = row.ERP_CREATION_DATE;
          item.erpLastUpdateDate = row.ERP_LAST_UPDATE_DATE;
          item.erpEnabledFlag = row.ERP_ENABLED_FLAG;

          const saved = await this.stgErpItemRepository.save(item);
          savedItems.push(saved);
        }
      }

      return savedItems;

    } catch (err) {
      console.error('Error syncing items:', err);
      throw err;
    }
  }

  /**
   * ดึงข้อมูล Order Headers จาก Oracle ERP
   * ดึง Sales Orders ที่ BOOKED อยู่ใน Organization 82
   */
  async syncOrderHeaders(): Promise<any> {
    let conn;
    try {
      conn = await this.connect();

      const sql = `
        SELECT DISTINCT
              ODH.HEADER_ID         AS ERP_ORDER_HEADER_ID,
              ODH.ORG_ID            AS ERP_ORG_ID,
              ODH.ORDERED_DATE      AS ERP_ORDER_DATE,
              ODH.ORDER_NUMBER      AS ERP_ORDER_NUMBER,
              ODT.NAME              AS ERP_ORDER_TYPE,
              CUS.CUSTOMER_NUMBER   AS ERP_CUSTOMER_NUMBER,
              CUS.CUSTOMER_NAME     AS ERP_CUSTOMER_NAME,
              CUS.ATTRIBUTE1        AS ERP_CUSTOMER_GRADE,
              ODH.CREATION_DATE     AS ERP_CREATION_DATE,
              ODH.LAST_UPDATE_DATE  AS ERP_LAST_UPDATE_DATE,
              ODH.FLOW_STATUS_CODE  AS ERP_ORDER_STATUS
        FROM   OE_ORDER_HEADERS_ALL ODH
              JOIN OE_ORDER_LINES_ALL ODL ON ODL.HEADER_ID = ODH.HEADER_ID
              JOIN OE_TRANSACTION_TYPES_TL ODT ON ODT.TRANSACTION_TYPE_ID = ODH.ORDER_TYPE_ID
              JOIN AR_CUSTOMERS CUS ON CUS.CUSTOMER_ID = ODH.SOLD_TO_ORG_ID
        WHERE  ODT.NAME LIKE 'SFO%SO'
        AND    EXTRACT(MONTH FROM ODL.SCHEDULE_SHIP_DATE) >= 5
        AND    ODH.CANCELLED_FLAG = 'N'
        AND    ODH.ORG_ID = 82
        ORDER BY ODH.ORDERED_DATE DESC
      `;

      const result = await conn.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      const erpRows: any[] = result.rows || [];
      const savedOrders = [];

      for (const row of erpRows) {
        // Upsert: find existing or create new
        let order = await this.stgErpOrderHeaderRepository.findOne({
          where: { erpOrderHeaderId: row.ERP_ORDER_HEADER_ID, erpOrgId: row.ERP_ORG_ID },
        });

        if (!order) {
          order = this.stgErpOrderHeaderRepository.create();
        }

        order.erpOrderHeaderId = row.ERP_ORDER_HEADER_ID;
        order.erpOrgId = row.ERP_ORG_ID;
        order.erpOrderDate = row.ERP_ORDER_DATE;
        order.erpOrderNumber = String(row.ERP_ORDER_NUMBER ?? '');
        order.erpOrderType = String(row.ERP_ORDER_TYPE ?? '');
        order.erpCustomerNumber = String(row.ERP_CUSTOMER_NUMBER ?? '');
        order.erpCustomerName = String(row.ERP_CUSTOMER_NAME ?? '');
        order.erpCustomerGrade = String(row.ERP_CUSTOMER_GRADE ?? '');
        order.erpCreationDate = row.ERP_CREATION_DATE;
        order.erpLastUpdateDate = row.ERP_LAST_UPDATE_DATE;
        order.erpOrderStatus = String(row.ERP_ORDER_STATUS ?? '');

        const saved = await this.stgErpOrderHeaderRepository.save(order);
        savedOrders.push(saved);
      }

      return savedOrders;
    } catch (err) {
      console.error('Error syncing order headers:', err);
      throw err;
    }
  }

  /**
   * ดึงข้อมูล Order Headers จาก Local DB (SQL Server) ที่ Sync มาแล้ว
   */
  async getLocalOrderHeaders(): Promise<StgErpOrderHeader[]> {
    return this.stgErpOrderHeaderRepository.find({
      order: { erpOrderDate: 'DESC' },
    });
  }

  /**
   * ดึงข้อมูล Order Lines จาก Oracle ERP ตาม Header IDs ที่ Sync มาแล้ว
   */
  async syncOrderLines(): Promise<any> {
    let conn;
    try {
      conn = await this.connect();

      // ดึง Header IDs ที่มีอยู่ในระบบ
      const headers = await this.stgErpOrderHeaderRepository.find();
      if (headers.length === 0) return [];

      const headerIds = headers.map(h => h.erpOrderHeaderId);
      const savedLines = [];

      // Oracle has a limit of 1000 items in an IN clause. 
      // We chunk the headerIds into groups of 1000.
      const chunkSize = 1000;
      for (let i = 0; i < headerIds.length; i += chunkSize) {
        const chunk = headerIds.slice(i, i + chunkSize);
        const bindNames = chunk.map((_, idx) => `:hid${idx}`).join(', ');

        const sql = `
          SELECT ODL.LINE_ID             AS ERP_ORDER_LINE_ID,
                 ODL.HEADER_ID           AS ERP_ORDER_HEADER_ID,
                 ODL.ORG_ID              AS ERP_ORG_ID,
                 ODL.LINE_NUMBER         AS ERP_ORDER_LINE_NUMBER,
                 ODL.INVENTORY_ITEM_ID   AS ERP_ORDER_ITEM_ID,
                 ODL.ORDERED_ITEM        AS ERP_ORDER_ITEM_CODE,
                 ODL.ORDERED_QUANTITY    AS ERP_ORDER_ITEM_QTY,
                 ODL.ORDER_QUANTITY_UOM  AS ERP_ORDER_ITEM_UOM,
                 ODL.SCHEDULE_SHIP_DATE  AS ERP_ORDER_SHIP_DATE,
                 ODL.CREATION_DATE       AS ERP_CREATION_DATE,
                 ODL.LAST_UPDATE_DATE    AS ERP_LAST_UPDATE_DATE,
                 ODL.FLOW_STATUS_CODE    AS ERP_ORDER_STATUS
          FROM   OE_ORDER_LINES_ALL ODL
          WHERE  ODL.HEADER_ID IN (${bindNames})
          ORDER BY ODL.HEADER_ID, ODL.LINE_NUMBER
        `;

        const binds: any = {};
        chunk.forEach((id, idx) => {
          binds[`hid${idx}`] = id;
        });

        const result = await conn.execute(sql, binds, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });

        const erpRows: any[] = result.rows || [];

        for (const row of erpRows) {
          let line = await this.stgErpOrderLineRepository.findOne({
            where: { erpOrderLineId: row.ERP_ORDER_LINE_ID, erpOrgId: row.ERP_ORG_ID },
          });

          if (!line) {
            line = this.stgErpOrderLineRepository.create();
          }

          line.erpOrderLineId = row.ERP_ORDER_LINE_ID;
          line.erpOrderHeaderId = row.ERP_ORDER_HEADER_ID;
          line.erpOrgId = row.ERP_ORG_ID;
          line.erpOrderLineNumber = String(row.ERP_ORDER_LINE_NUMBER);
          line.erpOrderItemId = row.ERP_ORDER_ITEM_ID;
          line.erpOrderItemCode = String(row.ERP_ORDER_ITEM_CODE ?? '');
          line.erpOrderItemQty = row.ERP_ORDER_ITEM_QTY;
          line.erpOrderItemUom = String(row.ERP_ORDER_ITEM_UOM ?? '');
          line.erpOrderShipDate = row.ERP_ORDER_SHIP_DATE;
          line.erpCreationDate = row.ERP_CREATION_DATE;
          line.erpLastUpdateDate = row.ERP_LAST_UPDATE_DATE;
          line.erpOrderStatus = String(row.ERP_ORDER_STATUS ?? '');

          const saved = await this.stgErpOrderLineRepository.save(line);
          savedLines.push(saved);
        }
      }

      return savedLines;
    } catch (err) {
      console.error('Error syncing order lines:', err);
      throw err;
    }
  }

  /**
   * ดึงข้อมูล Order Lines จาก Local DB (SQL Server) ที่ Sync มาแล้ว
   */
  async getLocalOrderLines(): Promise<StgErpOrderLine[]> {
    return this.stgErpOrderLineRepository.find({
      order: { erpOrderHeaderId: 'DESC', erpOrderLineNumber: 'ASC' },
    });
  }

  /**
   * ดึงข้อมูล Orders สำหรับ Demand Management (Header + Lines + Item Desc จาก stg_erp_items)
   */
  async getDemandOrders(): Promise<any[]> {
    const headers = await this.stgErpOrderHeaderRepository.find({ order: { erpOrderDate: 'DESC' } });
    const lines = await this.stgErpOrderLineRepository.find();
    const items = await this.stgErpItemRepository.find();

    // สร้าง Map ของ Item Code -> Item Description
    const itemMap = new Map<string, string>();
    items.forEach(i => itemMap.set(i.erpItemCode, i.erpItemDesc));

    return headers.map(h => ({
      ...h,
      lines: lines
        .filter(l => l.erpOrderHeaderId === h.erpOrderHeaderId)
        .sort((a, b) => Number(a.erpOrderLineNumber) - Number(b.erpOrderLineNumber))
        .map(l => ({
          ...l,
          erpItemDesc: itemMap.get(l.erpOrderItemCode) || null,
          isItemSynced: itemMap.has(l.erpOrderItemCode),
        })),
    }));
  }

  /**
   * ปิดการเชื่อมต่อเมื่อ Module ถูกทำลาย (แอปปิดตัว)
   */
  async onModuleDestroy() {
    if (this.connection) {
      try {
        await this.connection.close();
        console.log('Oracle Database connection closed');
      } catch (err) {
        console.error('Error closing Oracle connection:', err);
      }
    }
  }
}
