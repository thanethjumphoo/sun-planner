import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StgErpItem } from './stg-erp-item.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';

@Injectable()
export class OracleIntegrationService implements OnModuleDestroy {
  private pool: oracledb.Pool | null = null;

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
   * ฟังก์ชันเปิดใช้งาน Connection Pool
   */
  async getPool(): Promise<oracledb.Pool> {
    if (this.pool) return this.pool;

    try {
      this.pool = await oracledb.createPool({
        user: process.env.ORACLE_DB_USER || 'apps',
        password: process.env.ORACLE_DB_PASS || 'apps',
        connectString: `${process.env.ORACLE_DB_HOST || '172.25.10.12'}:${process.env.ORACLE_DB_PORT || '1522'}/${process.env.ORACLE_DB_SERVICE || 'PROD'}`,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
      });
      console.log('✅ Oracle Connection Pool initialized successfully');
      return this.pool;
    } catch (err) {
      console.error('Oracle connection pool initialization error:', err);
      throw err;
    }
  }

  /**
   * ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูล Oracle ERP โดยดึงจาก Pool
   */
  async connect(): Promise<oracledb.Connection> {
    const pool = await this.getPool();
    return pool.getConnection();
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
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (e) {
          console.error('Error closing oracle connection:', e);
        }
      }
    }
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

      const savedItems = [];
      const chunkSize = 990;

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
            where: { erpItemCode: row.ERP_ITEM_CODE, erpOrgId: row.ERP_ORG_ID },
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
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (e) {
          console.error('Error closing oracle connection:', e);
        }
      }
    }
  }

  /**
   * ดึงข้อมูล Item ทั้งหมดจาก Local DB
   */
  async getLocalItems(): Promise<StgErpItem[]> {
    return this.stgErpItemRepository.find({ order: { erpItemCode: 'ASC' }, take: 1000 });
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
        WHERE (ODT.NAME LIKE 'SFO%SO'
                OR ODT.NAME LIKE 'SFO%F')
        AND    ODL.SCHEDULE_SHIP_DATE >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -3)
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
          where: {
            erpOrderHeaderId: row.ERP_ORDER_HEADER_ID,
            erpOrgId: row.ERP_ORG_ID,
          },
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
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (e) {
          console.error('Error closing oracle connection:', e);
        }
      }
    }
  }

  /**
   * ดึงข้อมูล Order Headers จาก Local DB (SQL Server) ที่ Sync มาแล้ว
   */
  async getLocalOrderHeaders(): Promise<StgErpOrderHeader[]> {
    return this.stgErpOrderHeaderRepository.find({
      order: { erpOrderDate: 'DESC' }
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

      const headerIds = headers.map((h) => h.erpOrderHeaderId);
      const savedLines = [];

      // Oracle has a limit of 1000 items in an IN clause.
      // We chunk the headerIds into groups of 990 to be safe.
      const chunkSize = 990;
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
                 NVL(
                   NULLIF(
                     INV_CONVERT.inv_um_convert(
                       ODL.INVENTORY_ITEM_ID,
                       5,
                       ODL.ORDERED_QUANTITY,
                       ODL.ORDER_QUANTITY_UOM,
                       'KG',
                       NULL,
                       NULL
                     ), 
                     -99999
                   ),
                   ODL.ORDERED_QUANTITY
                 )                       AS ERP_ORDER_ITEM_QTY,
                 CASE
                   WHEN ODL.ORDER_QUANTITY_UOM != 'KG' 
                        AND NVL(INV_CONVERT.inv_um_convert(ODL.INVENTORY_ITEM_ID, 5, 1, ODL.ORDER_QUANTITY_UOM, 'KG', NULL, NULL), -99999) != -99999
                     THEN 'KG'
                   ELSE ODL.ORDER_QUANTITY_UOM
                 END                     AS ERP_ORDER_ITEM_UOM,
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
        if (erpRows.length === 0) {
          continue;
        }
        const linesToSave = [];

        // 1. Fetch existing lines in one go for this chunk to check existence
        const erpLineIds = erpRows
          .map((r) => r.ERP_ORDER_LINE_ID)
          .filter((id) => id !== undefined && id !== null);
        if (erpLineIds.length === 0) {
          continue;
        }

        // 1b. Fetch existing lines in chunks of 500 to avoid MS SQL 2100 parameter limit
        const existingLines: StgErpOrderLine[] = [];
        const mssqlChunkSize = 500;
        for (let j = 0; j < erpLineIds.length; j += mssqlChunkSize) {
          const mssqlChunk = erpLineIds.slice(j, j + mssqlChunkSize);
          const chunkLines = await this.stgErpOrderLineRepository.find({
            where: mssqlChunk.map((id) => ({
              erpOrderLineId: id,
              erpOrgId: 82,
            })),
          });
          existingLines.push(...chunkLines);
        }
        const lineMap = new Map(
          existingLines.map((l) => [`${l.erpOrderLineId}_${l.erpOrgId}`, l]),
        );

        for (const row of erpRows) {
          const key = `${row.ERP_ORDER_LINE_ID}_${row.ERP_ORG_ID}`;
          let line = lineMap.get(key);

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

          linesToSave.push(line);
        }

        // 2. Bulk save for this chunk in safe batches of 50 to avoid MS SQL 2100 parameter limit
        if (linesToSave.length > 0) {
          const saveChunkSize = 50;
          for (let k = 0; k < linesToSave.length; k += saveChunkSize) {
            const chunkToSave = linesToSave.slice(k, k + saveChunkSize);
            const saved =
              await this.stgErpOrderLineRepository.save(chunkToSave);
            savedLines.push(...saved);
          }
        }
      }

      return savedLines;
    } catch (err) {
      console.error('Error syncing order lines:', err);
      throw err;
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (e) {
          console.error('Error closing oracle connection:', e);
        }
      }
    }
  }

  /**
   * ดึงข้อมูล Order Lines จาก Local DB (SQL Server) ที่ Sync มาแล้ว
   */
  async getLocalOrderLines(): Promise<StgErpOrderLine[]> {
    return this.stgErpOrderLineRepository.find({
      order: { erpOrderHeaderId: 'DESC', erpOrderLineNumber: 'ASC' }
    });
  }

  /**
   * บันทึกรายการ Order แบบ Manual (IVQF, YTR, etc.)
   */
  async saveManualOrder(data: {
    erpOrderNumber: string;
    erpOrderType: string;
    erpCustomerName: string;
    erpOrderDate: string;
    lines: {
      erpOrderItemCode: string;
      erpOrderItemQty: number;
      erpOrderShipDate: string;
    }[];
  }): Promise<any> {
    // 1. Create Header
    const header = this.stgErpOrderHeaderRepository.create({
      erpOrderNumber: data.erpOrderNumber,
      erpOrderType: data.erpOrderType,
      erpCustomerName: data.erpCustomerName,
      erpOrderDate: new Date(data.erpOrderDate),
      erpOrderStatus: 'BOOKED',
      erpOrgId: 82,
      isManual: true,
      erpCreationDate: new Date(),
      erpLastUpdateDate: new Date(),
    });

    const savedHeader = await this.stgErpOrderHeaderRepository.save(header);

    // Use a high offset for manual header IDs to avoid collision with Oracle IDs
    savedHeader.erpOrderHeaderId = 900000000 + savedHeader.id;
    await this.stgErpOrderHeaderRepository.save(savedHeader);

    // 2. Create Lines
    const savedLines = [];
    for (let i = 0; i < data.lines.length; i++) {
      const lineData = data.lines[i];
      let line = this.stgErpOrderLineRepository.create({
        erpOrderHeaderId: savedHeader.erpOrderHeaderId,
        erpOrgId: 82,
        erpOrderLineNumber: String(i + 1),
        erpOrderItemCode: lineData.erpOrderItemCode,
        erpOrderItemQty: lineData.erpOrderItemQty,
        erpOrderItemUom: 'KG', // Default
        erpOrderShipDate: new Date(lineData.erpOrderShipDate),
        erpOrderStatus: 'BOOKED',
        isManual: true,
        erpCreationDate: new Date(),
        erpLastUpdateDate: new Date(),
      });
      line = await this.stgErpOrderLineRepository.save(line);
      line.erpOrderLineId = 900000000 + line.id;
      await this.stgErpOrderLineRepository.save(line);
      savedLines.push(line);
    }

    return { ...savedHeader, lines: savedLines };
  }

  /**
   * แก้ไขรายการ Order แบบ Manual
   */
  async updateManualOrder(id: number, data: any): Promise<any> {
    const header = await this.stgErpOrderHeaderRepository.findOne({
      where: { id, isManual: true },
    });
    if (!header) throw new Error('Order not found');

    header.erpOrderNumber = data.erpOrderNumber;
    header.erpOrderType = data.erpOrderType;
    header.erpCustomerName = data.erpCustomerName;
    header.erpOrderDate = new Date(data.erpOrderDate);
    header.erpLastUpdateDate = new Date();
    await this.stgErpOrderHeaderRepository.save(header);

    // ลบ Lines เก่าทิ้งแล้วลงใหม่
    await this.stgErpOrderLineRepository.delete({
      erpOrderHeaderId: header.erpOrderHeaderId,
    });

    const savedLines = [];
    for (let i = 0; i < data.lines.length; i++) {
      const lineData = data.lines[i];
      let line = this.stgErpOrderLineRepository.create({
        erpOrderHeaderId: header.erpOrderHeaderId,
        erpOrgId: 82,
        erpOrderLineNumber: String(i + 1),
        erpOrderItemCode: lineData.erpOrderItemCode,
        erpOrderItemQty: lineData.erpOrderItemQty,
        erpOrderItemUom: 'KG',
        erpOrderShipDate: new Date(lineData.erpOrderShipDate),
        erpOrderStatus: 'BOOKED',
        isManual: true,
        erpCreationDate: new Date(),
        erpLastUpdateDate: new Date(),
      });
      line = await this.stgErpOrderLineRepository.save(line);
      line.erpOrderLineId = 900000000 + line.id;
      await this.stgErpOrderLineRepository.save(line);
      savedLines.push(line);
    }

    return { ...header, lines: savedLines };
  }

  /**
   * ลบรายการ Order แบบ Manual
   */
  async deleteManualOrder(headerId: number): Promise<any> {
    const header = await this.stgErpOrderHeaderRepository.findOne({
      where: { id: headerId, isManual: true },
    });
    if (!header) throw new Error('Order not found or not a manual order');

    // Delete lines first
    await this.stgErpOrderLineRepository.delete({
      erpOrderHeaderId: header.erpOrderHeaderId,
    });
    // Delete header
    await this.stgErpOrderHeaderRepository.delete(header.id);

    return { success: true };
  }

  /**
   * ดึงข้อมูล Orders สำหรับ Demand Management (Header + Lines + Item Desc จาก stg_erp_items)
   */
  async getDemandOrders(query?: {
    page?: string;
    limit?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    searchText?: string;
    isManual?: string;
    shipStartDate?: string;
    shipEndDate?: string;
    grade?: string;
  }): Promise<any> {
    const page = query?.page;
    const limit = query?.limit;
    const startDate = query?.startDate;
    const endDate = query?.endDate;
    const status = query?.status;
    const searchText = query?.searchText;
    const isManual = query?.isManual;
    const shipStartDate = query?.shipStartDate;
    const shipEndDate = query?.shipEndDate;
    const grade = query?.grade;
    const headerIdsParam = (query as any)?.headerIds;
    const lineIdsParam = (query as any)?.lineIds;

    const queryBuilder = this.stgErpOrderHeaderRepository.createQueryBuilder('header');

    if (startDate && endDate) {
      queryBuilder.andWhere('header.erpOrderDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    } else if (startDate) {
      queryBuilder.andWhere('header.erpOrderDate >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('header.erpOrderDate <= :endDate', { endDate });
    }

    if (shipStartDate && shipEndDate) {
      let subQueryCondition = `header.erpOrderHeaderId IN (
        SELECT DISTINCT l.erp_order_header_id 
        FROM stg_erp_order_lines l 
        WHERE l.erp_order_ship_date BETWEEN :shipStartDate AND :shipEndDate
      )`;
      
      const binds: any = { shipStartDate, shipEndDate };
      const orConditions = [];

      if (headerIdsParam) {
        const ids = headerIdsParam.split(',').map((id: string) => parseInt(id.trim(), 10)).filter(Boolean);
        if (ids.length > 0) {
          orConditions.push(`header.erpOrderHeaderId IN (:...headerIds)`);
          binds.headerIds = ids;
        }
      }

      if (lineIdsParam) {
        const lineIds = lineIdsParam.split(',').map((id: string) => parseInt(id.trim(), 10)).filter(Boolean);
        if (lineIds.length > 0) {
          orConditions.push(`header.erpOrderHeaderId IN (
            SELECT DISTINCT l2.erp_order_header_id 
            FROM stg_erp_order_lines l2 
            WHERE l2.erp_order_line_id IN (:...lineIds)
          )`);
          binds.lineIds = lineIds;
        }
      }

      if (orConditions.length > 0) {
        subQueryCondition = `(${subQueryCondition} OR ${orConditions.join(' OR ')})`;
      }
      
      queryBuilder.andWhere(subQueryCondition, binds);
    } else {
      const binds: any = {};
      const orConditions = [];

      if (headerIdsParam) {
        const ids = headerIdsParam.split(',').map((id: string) => parseInt(id.trim(), 10)).filter(Boolean);
        if (ids.length > 0) {
          orConditions.push(`header.erpOrderHeaderId IN (:...headerIds)`);
          binds.headerIds = ids;
        }
      }

      if (lineIdsParam) {
        const lineIds = lineIdsParam.split(',').map((id: string) => parseInt(id.trim(), 10)).filter(Boolean);
        if (lineIds.length > 0) {
          orConditions.push(`header.erpOrderHeaderId IN (
            SELECT DISTINCT l2.erp_order_header_id 
            FROM stg_erp_order_lines l2 
            WHERE l2.erp_order_line_id IN (:...lineIds)
          )`);
          binds.lineIds = lineIds;
        }
      }

      if (orConditions.length > 0) {
        queryBuilder.andWhere(`(${orConditions.join(' OR ')})`, binds);
      }
    }

    if (status && status !== 'ALL') {
      queryBuilder.andWhere('header.erpOrderStatus = :status', { status });
    }

    if (grade && grade !== 'ALL') {
      queryBuilder.andWhere('header.erpCustomerGrade = :grade', { grade });
    }

    if (isManual !== undefined) {
      queryBuilder.andWhere('header.isManual = :isManual', { isManual: isManual === 'true' ? 1 : 0 });
    }

    if (searchText) {
      queryBuilder.andWhere(
        '(header.erpOrderNumber LIKE :search OR header.erpCustomerName LIKE :search OR header.erpCustomerNumber LIKE :search)',
        { search: `%${searchText}%` }
      );
    }

    queryBuilder.orderBy('header.erpOrderDate', 'DESC');

    let headers: StgErpOrderHeader[];
    let total = 0;
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    if (pageNum && limitNum) {
      queryBuilder.skip((pageNum - 1) * limitNum).take(limitNum);
      const [data, count] = await queryBuilder.getManyAndCount();
      headers = data;
      total = count;
    } else {
      queryBuilder.take(1000);
      headers = await queryBuilder.getMany();
    }

    if (headers.length === 0) {
      return pageNum && limitNum
        ? { success: true, data: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 }
        : [];
    }

    const headerIds = headers.map(h => h.erpOrderHeaderId);

    // Fetch lines only for these headers in chunks to avoid MS SQL 2100 param limit
    let lines: any[] = [];
    const chunkSize = 500;
    for (let i = 0; i < headerIds.length; i += chunkSize) {
      const chunkIds = headerIds.slice(i, i + chunkSize);
      const chunkLines = await this.stgErpOrderLineRepository.find({
        where: { erpOrderHeaderId: In(chunkIds) }
      });
      lines.push(...chunkLines);
    }

    // Extract unique item codes to fetch descriptions
    const uniqueItemCodes = [...new Set(lines.map(l => l.erpOrderItemCode))];
    let items: any[] = [];
    if (uniqueItemCodes.length > 0) {
      for (let i = 0; i < uniqueItemCodes.length; i += chunkSize) {
        const chunkCodes = uniqueItemCodes.slice(i, i + chunkSize);
        const chunkItems = await this.stgErpItemRepository.find({
          where: { erpItemCode: In(chunkCodes) }
        });
        items.push(...chunkItems);
      }
    }

    // สร้าง Map ของ Item Code -> Item Description
    const itemMap = new Map<string, string>();
    items.forEach((i) => itemMap.set(i.erpItemCode, i.erpItemDesc));

    // Fetch the sum of quantity_kg from mps_plan_orders grouped by erp_order_line_id
    const allocationMap = new Map<number, number>();
    const lineIds = lines.map(l => l.erpOrderLineId).filter(id => id !== null && id !== undefined);
    if (lineIds.length > 0) {
      const allocationChunkSize = 500;
      for (let i = 0; i < lineIds.length; i += allocationChunkSize) {
        const chunk = lineIds.slice(i, i + allocationChunkSize);
        const allAllocations = await this.stgErpOrderLineRepository.query(`
          SELECT erp_order_line_id AS lineId, SUM(quantity_kg) AS totalAllocated
          FROM mps_plan_orders
          WHERE erp_order_line_id IN (${chunk.join(',')})
          GROUP BY erp_order_line_id
        `);
        allAllocations.forEach((alloc: any) => {
          allocationMap.set(Number(alloc.lineId), Number(alloc.totalAllocated || 0));
        });
      }
    }

    const mappedData = headers.map((h) => ({
      ...h,
      lines: lines
        .filter((l) => l.erpOrderHeaderId === h.erpOrderHeaderId)
        .sort(
          (a, b) => Number(a.erpOrderLineNumber) - Number(b.erpOrderLineNumber),
        )
        .map((l) => ({
          ...l,
          erpItemDesc: itemMap.get(l.erpOrderItemCode) || null,
          isItemSynced: itemMap.has(l.erpOrderItemCode),
          totalAllocatedQty: allocationMap.get(l.erpOrderLineId) || 0,
        })),
    }));

    if (pageNum && limitNum) {
      return {
        success: true,
        data: mappedData,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } else {
      return mappedData;
    }
  }

  /**
   * ปิดการเชื่อมต่อเมื่อ Module ถูกทำลาย (แอปปิดตัว)
   */
  async onModuleDestroy() {
    if (this.pool) {
      try {
        await this.pool.close(10);
        console.log('Oracle Connection Pool closed successfully');
      } catch (err) {
        console.error('Error closing Oracle connection pool:', err);
      }
    }
  }
}
