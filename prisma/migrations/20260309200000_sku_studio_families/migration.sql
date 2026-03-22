-- SKU Studio: familias de producto, plantillas de creación, vínculo en InventoryItem

CREATE TABLE IF NOT EXISTS "ProductFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SkuCreationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "familyId" TEXT,
    "description" TEXT,
    "presetType" TEXT NOT NULL,
    "presetBaseUnit" TEXT NOT NULL,
    "presetStockTrackingMode" TEXT,
    "presetProductRole" TEXT,
    "skuPrefix" TEXT,
    "isBeverage" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "SkuCreationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductFamily_parentId_idx" ON "ProductFamily"("parentId");
CREATE INDEX IF NOT EXISTS "ProductFamily_name_idx" ON "ProductFamily"("name");

CREATE INDEX IF NOT EXISTS "SkuCreationTemplate_familyId_idx" ON "SkuCreationTemplate"("familyId");
CREATE INDEX IF NOT EXISTS "SkuCreationTemplate_isActive_idx" ON "SkuCreationTemplate"("isActive");

DO $$ BEGIN
  ALTER TABLE "ProductFamily" ADD CONSTRAINT "ProductFamily_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "familyId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "productRole" TEXT;

CREATE INDEX IF NOT EXISTS "InventoryItem_familyId_idx" ON "InventoryItem"("familyId");

DO $$ BEGIN
  ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SkuCreationTemplate" ADD CONSTRAINT "SkuCreationTemplate_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
