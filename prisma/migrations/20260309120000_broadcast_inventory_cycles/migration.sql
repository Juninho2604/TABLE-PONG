-- Comunicados a gerencia + ciclos de inventario (cortes con snapshot histórico)

CREATE TABLE "BroadcastMessage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryCycle" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "notes" TEXT,
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "InventoryCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryCycleSnapshot" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "quantityOnClose" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCostSnapshot" DOUBLE PRECISION,

    CONSTRAINT "InventoryCycleSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryCycle" ADD CONSTRAINT "InventoryCycle_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryCycle" ADD CONSTRAINT "InventoryCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryCycleSnapshot" ADD CONSTRAINT "InventoryCycleSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "InventoryCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryCycleSnapshot" ADD CONSTRAINT "InventoryCycleSnapshot_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryCycleSnapshot" ADD CONSTRAINT "InventoryCycleSnapshot_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InventoryCycleSnapshot_cycleId_inventoryItemId_areaId_key" ON "InventoryCycleSnapshot"("cycleId", "inventoryItemId", "areaId");

CREATE INDEX "InventoryCycleSnapshot_cycleId_idx" ON "InventoryCycleSnapshot"("cycleId");

CREATE INDEX "InventoryCycleSnapshot_areaId_idx" ON "InventoryCycleSnapshot"("areaId");

CREATE INDEX "BroadcastMessage_isActive_createdAt_idx" ON "BroadcastMessage"("isActive", "createdAt");

CREATE INDEX "InventoryCycle_closedAt_idx" ON "InventoryCycle"("closedAt");

CREATE INDEX "InventoryCycle_periodStart_idx" ON "InventoryCycle"("periodStart");
