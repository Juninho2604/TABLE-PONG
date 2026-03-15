-- ============================================================================
-- TABLE PONG - MIGRACIÓN FASE 1: CORRELACIÓN INTERCOMPANY
-- ============================================================================
-- POLÍTICA: Solo ADD, nunca DROP. Todos los campos nuevos son NULL o DEFAULT.
-- ============================================================================

-- ============================================================================
-- 1. PRECIO INTERCOMPANY EN MAPPING
-- ============================================================================
-- Agregar el precio que Shanklish cobra a TP por cada item

ALTER TABLE "IntercompanyItemMapping" ADD COLUMN IF NOT EXISTS "intercompanyPrice" DOUBLE PRECISION;
ALTER TABLE "IntercompanyItemMapping" ADD COLUMN IF NOT EXISTS "intercompanyCurrency" TEXT DEFAULT 'USD';
ALTER TABLE "IntercompanyItemMapping" ADD COLUMN IF NOT EXISTS "priceEffectiveFrom" TIMESTAMP(3);
ALTER TABLE "IntercompanyItemMapping" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- ============================================================================
-- 2. LÍNEAS DE DETALLE DE LIQUIDACIÓN
-- ============================================================================
-- Cada línea representa un item vendido por TP que proviene de Shanklish.
-- Vincula la venta real (SalesOrderItem) con la liquidación.

CREATE TABLE IF NOT EXISTS "IntercompanySettlementLine" (
    "id" TEXT NOT NULL,

    -- Liquidación padre
    "settlementId" TEXT NOT NULL,

    -- Venta que generó esta línea
    "salesOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,

    -- Snapshot del item al momento de la liquidación
    "menuItemSku" TEXT NOT NULL,
    "menuItemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    -- Precio de venta al cliente final (TP)
    "saleUnitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saleLineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Precio intercompany (lo que Shanklish cobra a TP)
    "intercompanyUnitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intercompanyLineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Margen de TP sobre este item
    "tpMarginPerUnit" DOUBLE PRECISION,
    "tpMarginPercent" DOUBLE PRECISION,

    -- Fecha de la venta original
    "soldAt" TIMESTAMP(3) NOT NULL,

    -- Metadata
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntercompanySettlementLine_pkey" PRIMARY KEY ("id")
);

-- Índices para consultas analíticas
CREATE INDEX IF NOT EXISTS "IntercompanySettlementLine_settlementId_idx" ON "IntercompanySettlementLine"("settlementId");
CREATE INDEX IF NOT EXISTS "IntercompanySettlementLine_salesOrderId_idx" ON "IntercompanySettlementLine"("salesOrderId");
CREATE INDEX IF NOT EXISTS "IntercompanySettlementLine_salesOrderItemId_idx" ON "IntercompanySettlementLine"("salesOrderItemId");
CREATE INDEX IF NOT EXISTS "IntercompanySettlementLine_menuItemSku_idx" ON "IntercompanySettlementLine"("menuItemSku");
CREATE INDEX IF NOT EXISTS "IntercompanySettlementLine_soldAt_idx" ON "IntercompanySettlementLine"("soldAt");

-- Evitar duplicar la misma línea de venta en la misma liquidación
CREATE UNIQUE INDEX IF NOT EXISTS "IntercompanySettlementLine_settlementId_salesOrderItemId_key" ON "IntercompanySettlementLine"("settlementId", "salesOrderItemId");

-- Foreign keys
ALTER TABLE "IntercompanySettlementLine" ADD CONSTRAINT "IntercompanySettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "IntercompanySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntercompanySettlementLine" ADD CONSTRAINT "IntercompanySettlementLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntercompanySettlementLine" ADD CONSTRAINT "IntercompanySettlementLine_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 3. RELACIÓN SETTLEMENT → LINES EN SETTLEMENT
-- ============================================================================
-- (La relación se maneja por FK, no necesita columna adicional en Settlement)

-- ============================================================================
-- 4. MARCAR ITEMS DEL MENÚ QUE PROVIENEN DE SHANKLISH
-- ============================================================================
-- Campo directo en MenuItem para saber rápidamente si es intercompany

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "isIntercompany" BOOLEAN DEFAULT false;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "intercompanySupplierCode" TEXT;

CREATE INDEX IF NOT EXISTS "MenuItem_isIntercompany_idx" ON "MenuItem"("isIntercompany");

-- ============================================================================
-- 5. SNAPSHOT INTERCOMPANY EN LÍNEAS DE VENTA
-- ============================================================================
-- Para que cada venta sepa si el item era intercompany y a qué precio

ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "isIntercompany" BOOLEAN DEFAULT false;
ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "intercompanyUnitPrice" DOUBLE PRECISION;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- SELECT COUNT(*) FROM "IntercompanySettlementLine";
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'MenuItem' AND column_name IN ('isIntercompany','intercompanySupplierCode');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'SalesOrderItem' AND column_name IN ('isIntercompany','intercompanyUnitPrice');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'IntercompanyItemMapping' AND column_name = 'intercompanyPrice';
-- ============================================================================
