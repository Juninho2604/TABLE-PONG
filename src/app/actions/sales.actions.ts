'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getCaracasDayRange } from '@/lib/datetime';

export interface SalesFilter {
    startDate?: Date;
    endDate?: Date;
    orderType?: string;
}

export interface ZReportData {
    period: string;
    totalOrders: number;
    grossTotal: number; // Subtotal
    totalDiscounts: number;
    discountBreakdown: {
        divisas: number;
        cortesias: number;
        other: number;
    };
    netTotal: number; // Total real cobrado
    paymentBreakdown: {
        cash: number;
        card: number;
        transfer: number;
        mobile: number;
        other: number;
    };
    ordersByStatus: Record<string, number>;
}

/** Obtiene una orden completa para reimprimir la nota de entrega */
export async function getOrderForReceiptAction(orderId: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        return { success: false, message: 'No autorizado para reimprimir notas de entrega' };
    }

    try {
        const order = await prisma.salesOrder.findUnique({
            where: { id: orderId },
            include: {
                items: { include: { modifiers: true } },
                createdBy: { select: { firstName: true, lastName: true } }
            }
        });
        if (!order) return { success: false, message: 'Orden no encontrada' };
        return { success: true, data: order };
    } catch (error) {
        console.error('Error fetching order for receipt:', error);
        return { success: false, message: 'Error al cargar la orden' };
    }
}

export async function getSalesHistoryAction(limit = 200) {
    try {
        const sales = await prisma.salesOrder.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                authorizedBy: {
                    select: { firstName: true, lastName: true }
                },
                createdBy: {
                    select: { firstName: true, lastName: true }
                },
                items: {
                    select: {
                        itemName: true,
                        quantity: true,
                        unitPrice: true,
                        lineTotal: true,
                        notes: true,
                    }
                }
            }
        });
        return { success: true, data: sales };
    } catch (error) {
        console.error('Error fetching sales:', error);
        return { success: false, message: 'Error cargando historial' };
    }
}


export async function cancelSaleAction(orderId: string, justification: string) {
    const session = await getSession();
    if (!session || !['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role)) {
        return { success: false, message: 'No autorizado para anular ventas' };
    }

    const reason = justification?.trim();
    if (!reason || reason.length < 5) {
        return { success: false, message: 'Debe indicar una justificación válida (mínimo 5 caracteres)' };
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.salesOrder.findUnique({
                where: { id: orderId },
                include: {
                    inventoryMovements: {
                        where: { movementType: 'SALE' }
                    }
                }
            });

            if (!order) throw new Error('Orden no encontrada');
            if (order.status === 'CANCELLED') throw new Error('La venta ya está anulada');

            for (const movement of order.inventoryMovements) {
                await tx.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: movement.inventoryItemId,
                            areaId: order.areaId,
                        }
                    },
                    update: {
                        currentStock: { increment: movement.quantity }
                    },
                    create: {
                        inventoryItemId: movement.inventoryItemId,
                        areaId: order.areaId,
                        currentStock: movement.quantity,
                    }
                });

                await tx.inventoryMovement.create({
                    data: {
                        inventoryItemId: movement.inventoryItemId,
                        movementType: 'ADJUSTMENT_IN',
                        quantity: movement.quantity,
                        unit: movement.unit,
                        unitCost: movement.unitCost,
                        totalCost: movement.totalCost,
                        reason: `Anulación venta ${order.orderNumber}`,
                        notes: reason,
                        createdById: session.id,
                        salesOrderId: order.id,
                    }
                });
            }

            const cancelledBy = `${session.firstName || ''} ${session.lastName || ''}`.trim() || session.id;
            const trace = `[ANULADA] ${new Date().toISOString()} por ${cancelledBy}. Motivo: ${reason}`;

            const updated = await tx.salesOrder.update({
                where: { id: order.id },
                data: {
                    status: 'CANCELLED',
                    paymentStatus: 'REFUNDED',
                    closedAt: new Date(),
                    notes: order.notes ? `${order.notes}\n${trace}` : trace,
                }
            });

            return updated;
        });

        revalidatePath('/dashboard/sales');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/pos/sportbar');
        return { success: true, message: `Venta ${result.orderNumber} anulada correctamente` };
    } catch (error) {
        console.error('Error cancelando venta:', error);
        return { success: false, message: error instanceof Error ? error.message : 'Error al anular venta' };
    }
}

export async function getDailyZReportAction(): Promise<{ success: boolean; data?: ZReportData; message?: string }> {
    try {
        const { start, end } = getCaracasDayRange();

        const todaysOrders = await prisma.salesOrder.findMany({
            where: {
                createdAt: {
                    gte: start,
                    lte: end
                },
                status: { not: 'CANCELLED' }
            }
        });

        // Cálculos
        let grossTotal = 0;
        let totalDiscounts = 0;
        let discountDivisas = 0;
        let discountCortesias = 0;
        let paymentCash = 0;
        let paymentCard = 0;
        let paymentTransfer = 0;
        let paymentMobile = 0;

        for (const order of todaysOrders) {
            grossTotal += order.subtotal;
            totalDiscounts += order.discount;

            // Desglose Descuentos
            if (order.discountType === 'DIVISAS_33') discountDivisas += order.discount;
            else if (order.discountType === 'CORTESIA_100') discountCortesias += order.discount;

            // Desglose Pagos (Total cobrado)
            const paid = order.total; // Asumimos total de orden como pagado si no está cancelada

            // Normalizar paymentMethod
            const pm = order.paymentMethod?.toUpperCase() || 'UNKNOWN';

            if (pm === 'CASH') paymentCash += paid;
            else if (pm === 'CARD' || pm === 'DEBIT_CARD') paymentCard += paid;
            else if (pm === 'TRANSFER' || pm === 'BANK_TRANSFER') paymentTransfer += paid;
            else if (pm === 'MOBILE_PAY' || pm === 'PAGO_MOVIL') paymentMobile += paid;
            else paymentMobile += paid; // Fallback temporal si hay "MULTIPLE" o raros, lo metemos en otros o mobile
        }

        const netTotal = grossTotal - totalDiscounts;

        return {
            success: true,
            data: {
                period: new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas' }).format(new Date()),
                totalOrders: todaysOrders.length,
                grossTotal,
                totalDiscounts,
                discountBreakdown: {
                    divisas: discountDivisas,
                    cortesias: discountCortesias,
                    other: totalDiscounts - discountDivisas - discountCortesias
                },
                netTotal,
                paymentBreakdown: {
                    cash: paymentCash,
                    card: paymentCard,
                    transfer: paymentTransfer,
                    mobile: paymentMobile,
                    other: 0
                },
                ordersByStatus: {}
            }
        };

    } catch (error) {
        console.error('Error generating Z report:', error);
        return { success: false, message: 'Error generando reporte Z' };
    }
}
