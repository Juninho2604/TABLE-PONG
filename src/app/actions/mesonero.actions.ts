'use server';

/**
 * Acciones para el módulo de Mesoneros
 * SEGURIDAD: Solo expone información operativa relevante al servicio de sala.
 * NO expone ventas, ingresos, costos ni ningún dato financiero.
 */

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

// ============================================================================
// TOP PRODUCTOS MÁS PEDIDOS (sin precios, solo popularidad)
// ============================================================================

export async function getMesoneroTopItemsAction() {
    const session = await getSession();
    if (!session?.id) return { success: false as const, data: null };

    // Últimos 30 días
    const since = new Date();
    since.setDate(since.getDate() - 30);

    try {
        const rows = await prisma.salesOrderItem.groupBy({
            by: ['itemName'],
            where: {
                order: {
                    status: { not: 'CANCELLED' },
                    createdAt: { gte: since },
                },
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10,
        });

        const data = rows.map(r => ({
            name: r.itemName,
            totalQty: Number(r._sum?.quantity ?? 0),
        }));

        return { success: true as const, data };
    } catch {
        return { success: false as const, data: null };
    }
}

// ============================================================================
// DISPONIBILIDAD DE ÍTEMS DEL MENÚ (sin precios)
// ============================================================================

export async function getMesoneroMenuAvailabilityAction() {
    const session = await getSession();
    if (!session?.id) return { success: false as const, data: null };

    try {
        const categories = await prisma.menuCategory.findMany({
            where: { isActive: true },
            select: {
                name: true,
                items: {
                    where: { isActive: true },
                    select: {
                        name: true,
                        isAvailable: true,
                    },
                    orderBy: { name: 'asc' },
                },
            },
            orderBy: { sortOrder: 'asc' },
        });

        // Solo categorías que tengan ítems
        const data = categories
            .filter(c => c.items.length > 0)
            .map(c => ({
                category: c.name,
                items: c.items.map(i => ({
                    name: i.name,
                    available: i.isAvailable,
                })),
            }));

        return { success: true as const, data };
    } catch {
        return { success: false as const, data: null };
    }
}

