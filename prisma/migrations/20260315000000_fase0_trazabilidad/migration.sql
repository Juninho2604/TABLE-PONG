-- ============================================================================
-- TABLE PONG - MIGRACIÓN FASE 0: TRAZABILIDAD
-- ============================================================================
-- POLÍTICA DE SEGURIDAD:
--   ✅ Solo ADD COLUMN / CREATE TABLE (nunca DROP ni RENAME)
--   ✅ Todos los campos nuevos son NULL o tienen DEFAULT
--   ✅ No se modifica ni elimina ningún dato existente
-- ============================================================================
-- EJECUTAR DESPUÉS DE HACER BACKUP:
--   pg_dump -Fc -h HOST -U USER -d neondb > backup_pre_fase0_tp.dump
-- ============================================================================

-- ============================================================================
-- 1. AUDIT LOG - Registro forense de operaciones (con branchId)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT,
    "changes" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" TEXT,
    "branchId" TEXT,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_module_idx" ON "AuditLog"("module");
CREATE INDEX IF NOT EXISTS "AuditLog_branchId_idx" ON "AuditLog"("branchId");

-- ============================================================================
-- 2. INTERCOMPANY ITEM MAPPING - Puente Shanklish ↔ TP
-- ============================================================================

CREATE TABLE IF NOT EXISTS "IntercompanyItemMapping" (
    "id" TEXT NOT NULL,
    "localItemId" TEXT NOT NULL,
    "externalSku" TEXT NOT NULL,
    "externalSystemCode" TEXT NOT NULL DEFAULT 'SHANKLISH',
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntercompanyItemMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntercompanyItemMapping_localItemId_externalSystemCode_key" ON "IntercompanyItemMapping"("localItemId", "externalSystemCode");
CREATE UNIQUE INDEX IF NOT EXISTS "IntercompanyItemMapping_externalSku_externalSystemCode_key" ON "IntercompanyItemMapping"("externalSku", "externalSystemCode");
CREATE INDEX IF NOT EXISTS "IntercompanyItemMapping_externalSku_idx" ON "IntercompanyItemMapping"("externalSku");

ALTER TABLE "IntercompanyItemMapping" ADD CONSTRAINT "IntercompanyItemMapping_localItemId_fkey" FOREIGN KEY ("localItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 3. SOFT DELETE - Agregar a entidades críticas
-- ============================================================================

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Area
ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Recipe
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- ProductionOrder
ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- ProteinProcessing
ALTER TABLE "ProteinProcessing" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "ProteinProcessing" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Requisition
ALTER TABLE "Requisition" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Requisition" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- MenuCategory
ALTER TABLE "MenuCategory" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "MenuCategory" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- MenuItem
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- SalesOrder
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- DailyInventory
ALTER TABLE "DailyInventory" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "DailyInventory" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- InventoryLoan
ALTER TABLE "InventoryLoan" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "InventoryLoan" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- InventoryAudit
ALTER TABLE "InventoryAudit" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "InventoryAudit" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Supplier
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- Branch
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- OpenTab
ALTER TABLE "OpenTab" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "OpenTab" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- ============================================================================
-- 4. ANULACIÓN TRAZABLE EN SALES ORDER
-- ============================================================================

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 5. SNAPSHOT FINANCIERO - Tasa de cambio en ventas
-- ============================================================================

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "exchangeRateId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "exchangeRateValue" DOUBLE PRECISION;
ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "totalBs" DOUBLE PRECISION;

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 6. COST SNAPSHOT EN LÍNEAS DE VENTA
-- ============================================================================

ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "costPerUnit" DOUBLE PRECISION;
ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "costTotal" DOUBLE PRECISION;
ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "marginPerUnit" DOUBLE PRECISION;
ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "marginPercent" DOUBLE PRECISION;

-- ============================================================================
-- 7. ÁREA EN MOVIMIENTOS DE INVENTARIO + VINCULACIONES CRUZADAS
-- ============================================================================

ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "areaId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "productionOrderId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "requisitionId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "auditId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "proteinProcessingId" TEXT;

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "InventoryMovement_areaId_idx" ON "InventoryMovement"("areaId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_productionOrderId_idx" ON "InventoryMovement"("productionOrderId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_requisitionId_idx" ON "InventoryMovement"("requisitionId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_purchaseOrderId_idx" ON "InventoryMovement"("purchaseOrderId");

-- ============================================================================
-- 8. ÍNDICES DE SOFT DELETE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "InventoryItem_deletedAt_idx" ON "InventoryItem"("deletedAt");
CREATE INDEX IF NOT EXISTS "Recipe_deletedAt_idx" ON "Recipe"("deletedAt");
CREATE INDEX IF NOT EXISTS "MenuItem_deletedAt_idx" ON "MenuItem"("deletedAt");
CREATE INDEX IF NOT EXISTS "SalesOrder_deletedAt_idx" ON "SalesOrder"("deletedAt");
CREATE INDEX IF NOT EXISTS "Supplier_deletedAt_idx" ON "Supplier"("deletedAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_deletedAt_idx" ON "PurchaseOrder"("deletedAt");
CREATE INDEX IF NOT EXISTS "Requisition_deletedAt_idx" ON "Requisition"("deletedAt");
CREATE INDEX IF NOT EXISTS "Branch_deletedAt_idx" ON "Branch"("deletedAt");
CREATE INDEX IF NOT EXISTS "OpenTab_deletedAt_idx" ON "OpenTab"("deletedAt");

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- SELECT COUNT(*) FROM "AuditLog";
-- SELECT COUNT(*) FROM "IntercompanyItemMapping";
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'SalesOrder' AND column_name IN ('voidedAt','exchangeRateValue','totalBs','deletedAt');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'InventoryMovement' AND column_name = 'areaId';
-- ============================================================================
