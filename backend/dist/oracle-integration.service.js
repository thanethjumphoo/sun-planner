"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OracleIntegrationService = void 0;
const common_1 = require("@nestjs/common");
const oracledb = __importStar(require("oracledb"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stg_erp_item_entity_1 = require("./stg-erp-item.entity");
const stg_erp_order_header_entity_1 = require("./stg-erp-order-header.entity");
const stg_erp_order_line_entity_1 = require("./stg-erp-order-line.entity");
let OracleIntegrationService = class OracleIntegrationService {
    stgErpItemRepository;
    stgErpOrderHeaderRepository;
    stgErpOrderLineRepository;
    connection = null;
    constructor(stgErpItemRepository, stgErpOrderHeaderRepository, stgErpOrderLineRepository) {
        this.stgErpItemRepository = stgErpItemRepository;
        this.stgErpOrderHeaderRepository = stgErpOrderHeaderRepository;
        this.stgErpOrderLineRepository = stgErpOrderLineRepository;
        try {
            oracledb.initOracleClient();
            console.log('✅ Oracle Client initialized in Thick mode');
        }
        catch (err) {
            if (err.message && !err.message.includes('already been initialized')) {
                console.error('Failed to initialize Oracle Client:', err.message);
            }
        }
    }
    async connect() {
        if (this.connection) {
            return this.connection;
        }
        try {
            this.connection = await oracledb.getConnection({
                user: process.env.ORACLE_DB_USER || 'apps',
                password: process.env.ORACLE_DB_PASS || 'apps',
                connectString: `${process.env.ORACLE_DB_HOST || '172.25.10.12'}:${process.env.ORACLE_DB_PORT || '1522'}/${process.env.ORACLE_DB_SERVICE || 'PROD'}`,
            });
            console.log('Successfully connected to Oracle Database');
            return this.connection;
        }
        catch (err) {
            console.error('Oracle connection error:', err);
            throw err;
        }
    }
    async getSalesOrders() {
        let conn;
        try {
            conn = await this.connect();
            const sql = `
        SELECT HEADER_ID, ORDER_NUMBER, ORDERED_DATE, FLOW_STATUS_CODE
        FROM OE_ORDER_HEADERS_ALL
        WHERE ROWNUM <= 10
        ORDER BY ORDERED_DATE DESC
      `;
            const result = await conn.execute(sql, [], {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
            });
            return result.rows;
        }
        catch (err) {
            console.error('Query execution error:', err);
            throw err;
        }
    }
    async syncItems(itemCodes) {
        if (!itemCodes || itemCodes.length === 0) {
            return [];
        }
        let conn;
        try {
            conn = await this.connect();
            const bindNames = itemCodes.map((_, i) => `:code${i}`).join(', ');
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
            const binds = {};
            itemCodes.forEach((code, i) => {
                binds[`code${i}`] = code;
            });
            const result = await conn.execute(sql, binds, {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
            });
            const erpRows = result.rows || [];
            const savedItems = [];
            for (const row of erpRows) {
                let item = await this.stgErpItemRepository.findOne({ where: { erpItemCode: row.ERP_ITEM_CODE, erpOrgId: row.ERP_ORG_ID } });
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
            return savedItems;
        }
        catch (err) {
            console.error('Error syncing items:', err);
            throw err;
        }
    }
    async syncOrderHeaders() {
        let conn;
        try {
            conn = await this.connect();
            const sql = `
        SELECT ODH.HEADER_ID         AS ERP_ORDER_HEADER_ID,
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
               JOIN OE_TRANSACTION_TYPES_TL ODT ON ODT.TRANSACTION_TYPE_ID = ODH.ORDER_TYPE_ID
               JOIN AR_CUSTOMERS CUS ON CUS.CUSTOMER_ID = ODH.SOLD_TO_ORG_ID
        WHERE  ODT.NAME LIKE 'SFO%SO'
        AND    EXTRACT(MONTH FROM ODH.ORDERED_DATE) >= 5
        AND    ODH.CANCELLED_FLAG = 'N'
        AND    ODH.ORG_ID = 82
        ORDER BY ODH.ORDERED_DATE DESC
      `;
            const result = await conn.execute(sql, [], {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
            });
            const erpRows = result.rows || [];
            const savedOrders = [];
            for (const row of erpRows) {
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
        }
        catch (err) {
            console.error('Error syncing order headers:', err);
            throw err;
        }
    }
    async getLocalOrderHeaders() {
        return this.stgErpOrderHeaderRepository.find({
            order: { erpOrderDate: 'DESC' },
        });
    }
    async syncOrderLines() {
        let conn;
        try {
            conn = await this.connect();
            const headers = await this.stgErpOrderHeaderRepository.find();
            if (headers.length === 0)
                return [];
            const headerIds = headers.map(h => h.erpOrderHeaderId);
            const bindNames = headerIds.map((_, i) => `:hid${i}`).join(', ');
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
            const binds = {};
            headerIds.forEach((id, i) => {
                binds[`hid${i}`] = id;
            });
            const result = await conn.execute(sql, binds, {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
            });
            const erpRows = result.rows || [];
            const savedLines = [];
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
            return savedLines;
        }
        catch (err) {
            console.error('Error syncing order lines:', err);
            throw err;
        }
    }
    async getLocalOrderLines() {
        return this.stgErpOrderLineRepository.find({
            order: { erpOrderHeaderId: 'DESC', erpOrderLineNumber: 'ASC' },
        });
    }
    async getDemandOrders() {
        const headers = await this.stgErpOrderHeaderRepository.find({ order: { erpOrderDate: 'DESC' } });
        const lines = await this.stgErpOrderLineRepository.find();
        const items = await this.stgErpItemRepository.find();
        const itemMap = new Map();
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
    async onModuleDestroy() {
        if (this.connection) {
            try {
                await this.connection.close();
                console.log('Oracle Database connection closed');
            }
            catch (err) {
                console.error('Error closing Oracle connection:', err);
            }
        }
    }
};
exports.OracleIntegrationService = OracleIntegrationService;
exports.OracleIntegrationService = OracleIntegrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(stg_erp_item_entity_1.StgErpItem)),
    __param(1, (0, typeorm_1.InjectRepository)(stg_erp_order_header_entity_1.StgErpOrderHeader)),
    __param(2, (0, typeorm_1.InjectRepository)(stg_erp_order_line_entity_1.StgErpOrderLine)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OracleIntegrationService);
//# sourceMappingURL=oracle-integration.service.js.map