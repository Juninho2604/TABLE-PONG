'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

// ============================================================================
// SUBCUENTAS (SPLIT BILLS)
// ============================================================================

/**
 * Crea una nueva subcuenta (OpenTab hijo) para una cuenta padre.
 * Hereda mesa, zona y mesonero del padre.
 */
export async function createSubTabAction(input: {
    parentTabId: string;
    customerLabel: string;
    customerPhone?: string;
}): Promise<{ success: boolean; data?: { id: string; tabCode: string }; message?: string }> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    const parent = await prisma.openTab.findUnique({
        where: { id: input.parentTabId },
        include: { subTabs: { select: { id: true }, where: { deletedAt: null } } }
    });

    if (!parent || !['OPEN', 'PARTIALLY_PAID'].includes(parent.status)) {
        return { success: false, message: 'La cuenta padre no está disponible' };
    }
    if (parent.parentTabId) {
        return { success: false, message: 'No se puede dividir una subcuenta' };
    }

    const nextIndex = parent.subTabs.length + 1;
    const subTabCode = `${parent.tabCode}-S${nextIndex}`;

    const subTab = await prisma.openTab.create({
        data: {
            branchId: parent.branchId,
            serviceZoneId: parent.serviceZoneId,
            tableOrStationId: parent.tableOrStationId,
            tabCode: subTabCode,
            customerLabel: input.customerLabel.trim(),
            customerPhone: input.customerPhone?.trim() || null,
            guestCount: 1,
            status: 'OPEN',
            parentTabId: parent.id,
            splitIndex: nextIndex,
            waiterLabel: parent.waiterLabel,
            assignedWaiterId: parent.assignedWaiterId,
            openedById: session.id,
        }
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');

    return { success: true, data: { id: subTab.id, tabCode: subTab.tabCode } };
}

/**
 * Mueve ítems seleccionados de la cuenta padre a una subcuenta.
 * Actualiza los totales de ambas cuentas en una transacción atómica.
 */
export async function assignItemsToSubTabAction(input: {
    parentTabId: string;
    subTabId: string;
    items: { itemId: string; quantity: number }[];
}): Promise<{ success: boolean; movedAmount?: number; message?: string }> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    const [parentTab, subTab] = await Promise.all([
        prisma.openTab.findUnique({
            where: { id: input.parentTabId },
            include: {
                orders: {
                    where: { paymentStatus: 'PENDING', deletedAt: null },
                    include: { items: { include: { modifiers: true } } }
                }
            }
        }),
        prisma.openTab.findUnique({ where: { id: input.subTabId } })
    ]);

    if (!parentTab || !subTab) return { success: false, message: 'Cuenta no encontrada' };
    if (subTab.parentTabId !== input.parentTabId) {
        return { success: false, message: 'Subcuenta no pertenece a esta cuenta' };
    }

    const allParentItems = parentTab.orders.flatMap(o =>
        o.items.map(i => ({ ...i, orderId: o.id }))
    );

    // Validate and collect valid moves
    const validMoves: {
        item: typeof allParentItems[0];
        quantity: number;
    }[] = [];

    for (const move of input.items) {
        if (move.quantity <= 0) continue;
        const item = allParentItems.find(i => i.id === move.itemId);
        if (!item) continue;
        const qty = Math.min(move.quantity, item.quantity);
        validMoves.push({ item, quantity: qty });
    }

    if (validMoves.length === 0) {
        return { success: false, message: 'No hay ítems válidos para mover' };
    }

    const totalMoved = await prisma.$transaction(async (tx) => {
        // Find or create a SalesOrder for the subtab
        let subOrder = await tx.salesOrder.findFirst({
            where: { openTabId: subTab.id, paymentStatus: 'PENDING', deletedAt: null }
        });

        if (!subOrder) {
            const area = await tx.area.findFirst({ where: { branchId: parentTab.branchId } });
            if (!area) throw new Error('No hay área configurada para esta sucursal');
            const tempOrderNum = `SPLIT-${subTab.id.slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

            subOrder = await tx.salesOrder.create({
                data: {
                    orderNumber: tempOrderNum,
                    orderType: 'RESTAURANT',
                    serviceFlow: 'OPEN_TAB',
                    sourceChannel: 'POS_SPORTBAR',
                    customerName: subTab.customerLabel || 'Subcuenta',
                    customerPhone: subTab.customerPhone,
                    status: 'CONFIRMED',
                    kitchenStatus: 'NOT_REQUIRED',
                    paymentStatus: 'PENDING',
                    subtotal: 0,
                    total: 0,
                    branchId: parentTab.branchId,
                    serviceZoneId: parentTab.serviceZoneId,
                    tableOrStationId: parentTab.tableOrStationId,
                    openTabId: subTab.id,
                    areaId: area.id,
                    createdById: session.id,
                }
            });

            await tx.openTabOrder.create({
                data: { openTabId: subTab.id, salesOrderId: subOrder.id }
            });
        }

        let moved = 0;
        const orderAmounts: Record<string, number> = {};

        for (const { item, quantity } of validMoves) {
            const unitEffective = item.lineTotal / item.quantity;
            const movedLineTotal = unitEffective * quantity;
            moved += movedLineTotal;
            orderAmounts[item.orderId] = (orderAmounts[item.orderId] || 0) + movedLineTotal;

            // Clone item into subtab order
            await tx.salesOrderItem.create({
                data: {
                    orderId: subOrder!.id,
                    menuItemId: item.menuItemId,
                    itemName: item.itemName,
                    unitPrice: item.unitPrice,
                    quantity,
                    lineTotal: movedLineTotal,
                    notes: item.notes,
                    modifiers: item.modifiers.length > 0 ? {
                        create: item.modifiers.map(m => ({
                            modifierId: m.modifierId ?? undefined,
                            name: m.name,
                            priceAdjustment: m.priceAdjustment,
                        }))
                    } : undefined
                }
            });

            // Reduce or remove original item
            const remaining = item.quantity - quantity;
            if (remaining <= 0) {
                await tx.salesOrderItem.delete({ where: { id: item.id } });
            } else {
                await tx.salesOrderItem.update({
                    where: { id: item.id },
                    data: { quantity: remaining, lineTotal: unitEffective * remaining }
                });
            }
        }

        // Recalculate parent order totals
        for (const [orderId, amount] of Object.entries(orderAmounts)) {
            await tx.salesOrder.update({
                where: { id: orderId },
                data: { subtotal: { decrement: amount }, total: { decrement: amount } }
            });
        }

        // Recalculate subtab order total
        await tx.salesOrder.update({
            where: { id: subOrder!.id },
            data: { subtotal: { increment: moved }, total: { increment: moved } }
        });

        // Update both tab balances
        await tx.openTab.update({
            where: { id: input.parentTabId },
            data: {
                runningSubtotal: { decrement: moved },
                runningTotal: { decrement: moved },
                balanceDue: { decrement: moved },
            }
        });

        await tx.openTab.update({
            where: { id: input.subTabId },
            data: {
                runningSubtotal: { increment: moved },
                runningTotal: { increment: moved },
                balanceDue: { increment: moved },
            }
        });

        return moved;
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');

    return { success: true, movedAmount: totalMoved };
}

/**
 * Cierra una cuenta con saldo $0 (p.ej. cuenta padre después de dividir todo).
 * NO registra pago — simplemente marca como CLOSED.
 */
export async function closeZeroBalanceTabAction(tabId: string): Promise<{ success: boolean; message?: string }> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    const tab = await prisma.openTab.findUnique({
        where: { id: tabId },
        select: { id: true, balanceDue: true, status: true, tableOrStationId: true, parentTabId: true }
    });

    if (!tab) return { success: false, message: 'Cuenta no encontrada' };
    if (tab.balanceDue > 0.01) return { success: false, message: 'La cuenta aún tiene saldo pendiente' };
    if (!['OPEN', 'PARTIALLY_PAID'].includes(tab.status)) {
        return { success: false, message: 'La cuenta ya está cerrada' };
    }

    // No cerrar la cuenta principal si hay subcuentas con saldo pendiente
    if (!tab.parentTabId) {
        const openSubTabsWithBalance = await prisma.openTab.count({
            where: {
                parentTabId: tabId,
                status: { in: ['OPEN', 'PARTIALLY_PAID'] },
                balanceDue: { gt: 0.01 }
            }
        });
        if (openSubTabsWithBalance > 0) {
            return { success: false, message: 'Hay subcuentas con saldo pendiente. Cóbrelas primero antes de cerrar la cuenta principal.' };
        }
    }

    await prisma.$transaction(async (tx) => {
        await tx.openTab.update({
            where: { id: tabId },
            data: { status: 'CLOSED', closedAt: new Date(), closedById: session.id }
        });

        // Liberar la mesa si es cuenta padre y no quedan subcuentas abiertas
        if (!tab.parentTabId && tab.tableOrStationId) {
            const openSubTabs = await tx.openTab.count({
                where: {
                    parentTabId: tabId,
                    status: { in: ['OPEN', 'PARTIALLY_PAID'] }
                }
            });
            if (openSubTabs === 0) {
                await tx.tableOrStation.update({
                    where: { id: tab.tableOrStationId },
                    data: { currentStatus: 'AVAILABLE' }
                });
            }
        }
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');

    return { success: true };
}
