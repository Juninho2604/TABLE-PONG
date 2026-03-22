'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { InventoryTypeValue } from '@/lib/constants/sku-studio';

const ADMIN_EMAIL = 'admin@tablepong.com';

function canUseSkuStudio(email: string | undefined, role: string): boolean {
    return role === 'OWNER' || (email?.toLowerCase() ?? '') === ADMIN_EMAIL;
}

async function requireSkuStudio() {
    const session = await getSession();
    if (!session) return { ok: false as const, message: 'No autorizado' };
    if (!canUseSkuStudio(session.email, session.role)) {
        return { ok: false as const, message: 'Solo el dueño o admin@tablepong.com pueden usar SKU Studio' };
    }
    return { ok: true as const, session };
}

function cleanSkuPrefix(prefix: string | undefined | null): string {
    const p = (prefix || 'SKU').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return (p || 'SKU').slice(0, 8);
}

async function generateUniqueSku(prefix: string): Promise<string> {
    const p = cleanSkuPrefix(prefix);
    for (let i = 0; i < 40; i++) {
        const sku = `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(
            0,
            32
        );
        const exists = await prisma.inventoryItem.findUnique({ where: { sku } });
        if (!exists) return sku;
    }
    const n = await prisma.inventoryItem.count();
    return `${p}-${String(n + 1).padStart(5, '0')}`;
}

// --- Familias ---

export async function listProductFamiliesAction() {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false as const, message: gate.message, data: [] };

    const rows = await prisma.productFamily.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { parent: { select: { id: true, name: true } } },
    });
    return { success: true as const, data: rows };
}

export async function createProductFamilyAction(input: {
    name: string;
    parentId?: string | null;
    icon?: string | null;
    color?: string | null;
    sortOrder?: number;
}) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    const name = input.name?.trim();
    if (!name) return { success: false, message: 'Nombre obligatorio' };

    const row = await prisma.productFamily.create({
        data: {
            name,
            parentId: input.parentId || null,
            icon: input.icon || null,
            color: input.color || null,
            sortOrder: input.sortOrder ?? 0,
        },
    });
    revalidatePath('/dashboard/config/sku-studio');
    return { success: true as const, data: row };
}

export async function updateProductFamilyAction(
    id: string,
    input: Partial<{ name: string; parentId: string | null; icon: string | null; color: string | null; sortOrder: number; isActive: boolean }>
) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    if (input.parentId === id) return { success: false, message: 'La familia no puede ser su propio padre' };

    const row = await prisma.productFamily.update({
        where: { id },
        data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            ...(input.icon !== undefined ? { icon: input.icon } : {}),
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
    });
    revalidatePath('/dashboard/config/sku-studio');
    return { success: true as const, data: row };
}

export async function deleteProductFamilyAction(id: string) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    const children = await prisma.productFamily.count({ where: { parentId: id } });
    if (children > 0) return { success: false, message: 'Elimina o reubica las subfamilias primero' };

    const used = await prisma.inventoryItem.count({ where: { familyId: id } });
    if (used > 0) return { success: false, message: 'Hay productos vinculados a esta familia' };

    await prisma.skuCreationTemplate.updateMany({ where: { familyId: id }, data: { familyId: null } });
    await prisma.productFamily.delete({ where: { id } });
    revalidatePath('/dashboard/config/sku-studio');
    return { success: true as const };
}

// --- Plantillas ---

export async function listSkuTemplatesAction() {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false as const, message: gate.message, data: [] };

    const rows = await prisma.skuCreationTemplate.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { family: { select: { id: true, name: true } } },
    });
    return { success: true as const, data: rows };
}

export async function createSkuTemplateAction(input: {
    name: string;
    familyId?: string | null;
    description?: string | null;
    presetType: string;
    presetBaseUnit: string;
    presetStockTrackingMode?: string | null;
    presetProductRole?: string | null;
    skuPrefix?: string | null;
    isBeverage?: boolean;
    sortOrder?: number;
}) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    const name = input.name?.trim();
    if (!name) return { success: false, message: 'Nombre obligatorio' };

    const row = await prisma.skuCreationTemplate.create({
        data: {
            name,
            familyId: input.familyId || null,
            description: input.description?.trim() || null,
            presetType: input.presetType,
            presetBaseUnit: input.presetBaseUnit,
            presetStockTrackingMode: input.presetStockTrackingMode || null,
            presetProductRole: input.presetProductRole || null,
            skuPrefix: input.skuPrefix?.trim() || null,
            isBeverage: input.isBeverage ?? false,
            sortOrder: input.sortOrder ?? 0,
            createdById: gate.session.id,
        },
    });
    revalidatePath('/dashboard/config/sku-studio');
    return { success: true as const, data: row };
}

export async function updateSkuTemplateAction(
    id: string,
    input: Partial<{
        name: string;
        familyId: string | null;
        description: string | null;
        presetType: string;
        presetBaseUnit: string;
        presetStockTrackingMode: string | null;
        presetProductRole: string | null;
        skuPrefix: string | null;
        isBeverage: boolean;
        sortOrder: number;
        isActive: boolean;
    }>
) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    const row = await prisma.skuCreationTemplate.update({
        where: { id },
        data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.familyId !== undefined ? { familyId: input.familyId } : {}),
            ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
            ...(input.presetType !== undefined ? { presetType: input.presetType } : {}),
            ...(input.presetBaseUnit !== undefined ? { presetBaseUnit: input.presetBaseUnit } : {}),
            ...(input.presetStockTrackingMode !== undefined ? { presetStockTrackingMode: input.presetStockTrackingMode } : {}),
            ...(input.presetProductRole !== undefined ? { presetProductRole: input.presetProductRole } : {}),
            ...(input.skuPrefix !== undefined ? { skuPrefix: input.skuPrefix?.trim() || null } : {}),
            ...(input.isBeverage !== undefined ? { isBeverage: input.isBeverage } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
    });
    revalidatePath('/dashboard/config/sku-studio');
    return { success: true as const, data: row };
}

// --- Crear ítem desde Studio ---

export async function createItemFromStudioAction(input: {
    name: string;
    familyId?: string | null;
    templateId?: string | null;
    type?: InventoryTypeValue;
    baseUnit?: string;
    stockTrackingMode?: string | null;
    productRole?: string | null;
    category?: string | null;
    skuPrefix?: string | null;
    isBeverage?: boolean;
    initialCost?: number;
    description?: string | null;
}) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    const name = input.name?.trim();
    if (!name) return { success: false, message: 'Nombre obligatorio' };

    let type: string = input.type ?? 'RAW_MATERIAL';
    let baseUnit = input.baseUnit ?? 'UNIT';
    let stockTrackingMode = input.stockTrackingMode ?? null;
    let productRole = input.productRole ?? null;
    let isBeverage = input.isBeverage ?? false;
    let skuPrefix = input.skuPrefix ?? null;
    let familyId: string | null = input.familyId ?? null;

    if (input.templateId) {
        const tpl = await prisma.skuCreationTemplate.findUnique({ where: { id: input.templateId } });
        if (tpl && tpl.isActive) {
            type = input.type ?? tpl.presetType;
            baseUnit = input.baseUnit ?? tpl.presetBaseUnit;
            stockTrackingMode = input.stockTrackingMode !== undefined ? input.stockTrackingMode : tpl.presetStockTrackingMode;
            productRole = input.productRole !== undefined ? input.productRole : tpl.presetProductRole;
            isBeverage = input.isBeverage !== undefined ? input.isBeverage : tpl.isBeverage;
            skuPrefix = input.skuPrefix ?? tpl.skuPrefix;
            familyId = input.familyId !== undefined ? input.familyId : tpl.familyId;
        }
    }

    const sku = await generateUniqueSku(skuPrefix || name);

    const item = await prisma.inventoryItem.create({
        data: {
            name,
            sku,
            type,
            baseUnit,
            category: input.category?.trim() || null,
            stockTrackingMode,
            productRole,
            familyId,
            isBeverage,
            isActive: true,
            description: input.description?.trim() || 'Creado desde SKU Studio',
        },
    });

    if (input.initialCost && input.initialCost > 0) {
        await prisma.costHistory.create({
            data: {
                inventoryItemId: item.id,
                costPerUnit: input.initialCost,
                createdById: gate.session.id,
                reason: 'Costo inicial (SKU Studio)',
                effectiveFrom: new Date(),
            },
        });
    }

    revalidatePath('/dashboard/inventario');
    revalidatePath('/dashboard/recetas');
    revalidatePath('/dashboard/produccion');
    revalidatePath('/dashboard/config/sku-studio');

    return { success: true as const, message: 'Producto creado', item };
}

export async function linkItemToFamilyAction(itemId: string, familyId: string | null) {
    const gate = await requireSkuStudio();
    if (!gate.ok) return { success: false, message: gate.message };

    await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { familyId },
    });
    revalidatePath('/dashboard/inventario');
    revalidatePath('/dashboard/config/sku-studio');
    return { success: true as const };
}
