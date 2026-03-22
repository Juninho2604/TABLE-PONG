'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'AREA_LEAD'];

function assertRole(role: string) {
    if (!ROLES.includes(role)) throw new Error('Sin permisos para ciclos de inventario');
}

/** Ciclo abierto = sin closedAt */
export async function getInventoryCyclesAction() {
    const session = await getSession();
    if (!session) return { success: false as const, message: 'No autorizado' };
    try {
        assertRole(session.role);
        const cycles = await prisma.inventoryCycle.findMany({
            orderBy: { periodStart: 'desc' },
            take: 80,
            include: {
                createdBy: { select: { firstName: true, lastName: true } },
                closedBy: { select: { firstName: true, lastName: true } },
            },
        });
        const open = cycles.find(c => !c.closedAt) || null;
        return { success: true as const, data: { cycles, openCycle: open } };
    } catch (e: any) {
        return { success: false as const, message: e?.message || 'Error' };
    }
}

export async function startInventoryCycleAction(input: {
    label: string;
    periodType: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';
    notes?: string;
}) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    try {
        assertRole(session.role);

        const existingOpen = await prisma.inventoryCycle.findFirst({
            where: { closedAt: null },
        });
        if (existingOpen) {
            return {
                success: false,
                message: `Ya existe un ciclo abierto: "${existingOpen.label}". Ciérralo antes de iniciar otro.`,
            };
        }

        const cycle = await prisma.inventoryCycle.create({
            data: {
                label: input.label.trim(),
                periodType: input.periodType,
                periodStart: new Date(),
                notes: input.notes?.trim() || null,
                createdById: session.id,
            },
        });

        revalidatePath('/dashboard/inventario/ciclos');
        return { success: true, message: 'Ciclo iniciado', data: cycle };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Error creando ciclo' };
    }
}

/** Cierra el ciclo: snapshot de todo InventoryLocation + marca fechas. No borra movimientos ni auditorías. */
export async function closeInventoryCycleAction(cycleId: string, notes?: string) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    try {
        assertRole(session.role);

        const cycle = await prisma.inventoryCycle.findUnique({ where: { id: cycleId } });
        if (!cycle) return { success: false, message: 'Ciclo no encontrado' };
        if (cycle.closedAt) return { success: false, message: 'Este ciclo ya está cerrado' };

        const locations = await prisma.inventoryLocation.findMany({
            where: { area: { isActive: true, deletedAt: null } },
            include: {
                inventoryItem: { select: { baseUnit: true } },
            },
        });

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            const snaps = locations.map(loc => ({
                cycleId: cycle.id,
                inventoryItemId: loc.inventoryItemId,
                areaId: loc.areaId,
                quantityOnClose: loc.currentStock,
                unit: loc.inventoryItem.baseUnit || 'UNIT',
                unitCostSnapshot: null as number | null,
            }));

            if (snaps.length) {
                await tx.inventoryCycleSnapshot.createMany({ data: snaps });
            }

            await tx.inventoryCycle.update({
                where: { id: cycleId },
                data: {
                    closedAt: now,
                    periodEnd: now,
                    closedById: session.id,
                    snapshotCount: snaps.length,
                    notes: notes?.trim() ? `${cycle.notes ? cycle.notes + ' | ' : ''}${notes.trim()}` : cycle.notes,
                },
            });
        });

        revalidatePath('/dashboard/inventario/ciclos');
        return { success: true, message: `Ciclo cerrado. Snapshot: ${locations.length} filas (ítem × área).` };
    } catch (e: any) {
        console.error(e);
        return { success: false, message: e?.message || 'Error al cerrar ciclo' };
    }
}

/** Áreas activas para filtrar snapshots */
export async function getInventoryAreasForCycleFilterAction() {
    const session = await getSession();
    if (!session) return { success: false as const, message: 'No autorizado' };
    try {
        assertRole(session.role);
        const areas = await prisma.area.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return { success: true as const, data: areas };
    } catch (e: any) {
        return { success: false as const, message: e?.message || 'Error' };
    }
}

export type CycleSnapshotRow = {
    id: string;
    quantityOnClose: number;
    unit: string;
    unitCostSnapshot: number | null;
    inventoryItem: { name: string; sku: string; baseUnit: string };
    area: { name: string };
};

/** Filas paginadas del snapshot de un ciclo cerrado */
export async function getCycleSnapshotRowsAction(
    cycleId: string,
    opts?: { areaId?: string | null; skip?: number; take?: number }
) {
    const session = await getSession();
    if (!session) return { success: false as const, message: 'No autorizado' };
    try {
        assertRole(session.role);

        const cycle = await prisma.inventoryCycle.findUnique({
            where: { id: cycleId },
            select: { id: true, closedAt: true, snapshotCount: true },
        });
        if (!cycle) return { success: false as const, message: 'Ciclo no encontrado' };
        if (!cycle.closedAt) {
            return { success: false as const, message: 'Este ciclo aún no tiene snapshot (sigue abierto)' };
        }

        const skip = Math.max(0, opts?.skip ?? 0);
        const take = Math.min(200, Math.max(1, opts?.take ?? 50));
        const areaId = opts?.areaId?.trim() || null;

        const where = {
            cycleId,
            ...(areaId ? { areaId } : {}),
        };

        const [total, rows] = await prisma.$transaction([
            prisma.inventoryCycleSnapshot.count({ where }),
            prisma.inventoryCycleSnapshot.findMany({
                where,
                skip,
                take,
                orderBy: [{ area: { name: 'asc' } }, { inventoryItem: { name: 'asc' } }],
                include: {
                    inventoryItem: { select: { name: true, sku: true, baseUnit: true } },
                    area: { select: { name: true } },
                },
            }),
        ]);

        return {
            success: true as const,
            data: {
                total,
                rows,
                pageSize: take,
                skip,
            },
        };
    } catch (e: any) {
        console.error(e);
        return { success: false as const, message: e?.message || 'Error' };
    }
}

/** CSV completo (filtrable por área) para descarga — máx. 25k filas */
export async function exportCycleSnapshotCsvAction(cycleId: string, areaId?: string | null) {
    const session = await getSession();
    if (!session) return { success: false as const, message: 'No autorizado' };
    try {
        assertRole(session.role);

        const cycle = await prisma.inventoryCycle.findUnique({
            where: { id: cycleId },
            select: { label: true, closedAt: true, periodType: true },
        });
        if (!cycle?.closedAt) {
            return { success: false as const, message: 'Sin snapshot para exportar' };
        }

        const aid = areaId?.trim() || null;
        const where = { cycleId, ...(aid ? { areaId: aid } : {}) };

        const rows = await prisma.inventoryCycleSnapshot.findMany({
            where,
            take: 25000,
            orderBy: [{ area: { name: 'asc' } }, { inventoryItem: { name: 'asc' } }],
            include: {
                inventoryItem: { select: { name: true, sku: true, baseUnit: true } },
                area: { select: { name: true } },
            },
        });

        const header = ['Almacén', 'SKU', 'Producto', 'Cantidad cierre', 'Unidad', 'Costo unit. snapshot'];
        const lines = [
            header.join(';'),
            ...rows.map(r =>
                [
                    escapeCsv(r.area.name),
                    escapeCsv(r.inventoryItem.sku),
                    escapeCsv(r.inventoryItem.name),
                    String(r.quantityOnClose).replace('.', ','),
                    escapeCsv(r.unit),
                    r.unitCostSnapshot != null ? String(r.unitCostSnapshot).replace('.', ',') : '',
                ].join(';')
            ),
        ];
        const csv = '\uFEFF' + lines.join('\r\n'); // BOM para Excel ES

        const safeLabel = cycle.label.replace(/[^\w\d\-]+/g, '_').slice(0, 60);
        const filename = `snapshot_${safeLabel}_${cycleId.slice(0, 8)}.csv`;

        return { success: true as const, data: { csv, filename } };
    } catch (e: any) {
        console.error(e);
        return { success: false as const, message: e?.message || 'Error exportando' };
    }
}

function escapeCsv(s: string): string {
    const t = String(s ?? '');
    if (/[;\r\n"]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
}
