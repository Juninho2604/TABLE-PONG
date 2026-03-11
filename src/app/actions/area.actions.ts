'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function getAreasForConfig() {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return prisma.area.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, isActive: true },
    });
}

export async function createAreaAction(name: string, description?: string) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!hasPermission(session.role, PERMISSIONS.MANAGE_USERS)) return { success: false, message: 'Sin permisos para crear almacenes' };

    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return { success: false, message: 'El nombre es obligatorio' };

    try {
        const existing = await prisma.area.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (existing) return { success: false, message: 'Ya existe un almacén con ese nombre' };

        await prisma.area.create({
            data: { name: trimmed, description: description?.trim() || null },
        });

        revalidatePath('/dashboard/almacenes');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/transferencias');
        return { success: true, message: 'Almacén creado correctamente' };
    } catch (error) {
        console.error('Error creating area:', error);
        return { success: false, message: 'Error al crear el almacén' };
    }
}

export async function toggleAreaStatusAction(id: string, isActive: boolean) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!hasPermission(session.role, PERMISSIONS.MANAGE_USERS)) return { success: false, message: 'Sin permisos' };

    try {
        await prisma.area.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath('/dashboard/almacenes');
        revalidatePath('/dashboard/inventario');
        return { success: true, message: isActive ? 'Almacén activado' : 'Almacén desactivado' };
    } catch (error) {
        console.error('Error toggling area:', error);
        return { success: false, message: 'Error al cambiar estado' };
    }
}

export async function getAreasWithInventoryAction() {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const areas = await prisma.area.findMany({
        orderBy: { name: 'asc' },
        include: {
            inventoryLocations: {
                select: { currentStock: true }
            }
        }
    });

    return areas.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        isActive: a.isActive,
        totalItems: a.inventoryLocations.length,
        totalStock: a.inventoryLocations.reduce((sum, loc) => sum + Number(loc.currentStock), 0),
        itemsWithStock: a.inventoryLocations.filter(loc => Number(loc.currentStock) > 0).length,
    }));
}

/**
 * Fusiona el área origen (source) en el área destino (target).
 * - Suma el stock de cada ítem del origen al destino
 * - Pone el stock del origen en 0 (no borra registros)
 * - Reasigna las órdenes de venta que apuntaban al origen hacia el destino
 * - Desactiva el área origen
 */
export async function mergeAreasAction(sourceId: string, targetId: string) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!hasPermission(session.role, PERMISSIONS.MANAGE_USERS)) return { success: false, message: 'Sin permisos' };

    if (sourceId === targetId) return { success: false, message: 'El origen y destino no pueden ser iguales' };

    try {
        const [source, target] = await Promise.all([
            prisma.area.findUnique({ where: { id: sourceId }, include: { inventoryLocations: true } }),
            prisma.area.findUnique({ where: { id: targetId } }),
        ]);

        if (!source || !target) return { success: false, message: 'Almacén no encontrado' };

        let itemsMerged = 0;

        await prisma.$transaction(async (tx) => {
            // Mover stock de cada ítem del origen al destino
            for (const loc of source.inventoryLocations) {
                if (Number(loc.currentStock) === 0) continue;

                await tx.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: loc.inventoryItemId,
                            areaId: targetId,
                        }
                    },
                    update: {
                        currentStock: { increment: loc.currentStock }
                    },
                    create: {
                        inventoryItemId: loc.inventoryItemId,
                        areaId: targetId,
                        currentStock: loc.currentStock,
                    }
                });

                // Poner origen en 0 (no borrar)
                await tx.inventoryLocation.update({
                    where: { id: loc.id },
                    data: { currentStock: 0 }
                });

                itemsMerged++;
            }

            // Reasignar órdenes de venta del origen al destino
            await tx.salesOrder.updateMany({
                where: { areaId: sourceId },
                data: { areaId: targetId }
            });

            // Desactivar área origen
            await tx.area.update({
                where: { id: sourceId },
                data: { isActive: false }
            });
        });

        revalidatePath('/dashboard/almacenes');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/sales');

        return {
            success: true,
            message: `Fusión completada: ${itemsMerged} producto(s) transferidos de "${source.name}" a "${target.name}". El almacén "${source.name}" fue desactivado.`
        };
    } catch (error) {
        console.error('Error merging areas:', error);
        return { success: false, message: 'Error al fusionar almacenes' };
    }
}

/**
 * Analiza los almacenes duplicados y devuelve un plan de limpieza
 */
export async function analyzeAreasAction() {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    const areas = await prisma.area.findMany({
        orderBy: { name: 'asc' },
        include: {
            inventoryLocations: {
                select: { currentStock: true, inventoryItemId: true }
            }
        }
    });

    const withStats = areas.map(a => ({
        id: a.id,
        name: a.name,
        isActive: a.isActive,
        itemsWithStock: a.inventoryLocations.filter(l => Number(l.currentStock) > 0).length,
        totalStock: a.inventoryLocations.reduce((s, l) => s + Number(l.currentStock), 0),
    }));

    // Detectar grupos duplicados (mismo nombre normalizado)
    const groups: Record<string, typeof withStats> = {};
    for (const a of withStats) {
        const key = a.name.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
    }

    const duplicates = Object.values(groups).filter(g => g.length > 1);
    const empty = withStats.filter(a => a.isActive && a.itemsWithStock === 0);

    return { areas: withStats, duplicates, empty };
}
