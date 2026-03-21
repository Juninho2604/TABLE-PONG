'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

// ============================================================================
// ALIADOS COMERCIALES — Intercompany Actions
// ============================================================================

export interface PartnerSummary {
    id: string;
    name: string;
    code: string | null;
    intercompanyCode: string | null;
    isActive: boolean;
    menuItemCount: number;
}

export interface PartnerSalesReport {
    partnerId: string;
    partnerName: string;
    periodStart: string;
    periodEnd: string;
    totalGrossSales: number;
    totalServiceCharge: number;  // Se queda en TP
    totalTip: number;            // Propinas (se quedan en TP)
    totalNetOwedToPartner: number; // Lo que TP le debe al aliado
    orderCount: number;
    itemCount: number;
    salesByMethod: { method: string; count: number; total: number }[];
    topItems: { name: string; qty: number; total: number }[];
}

/** Lista todos los aliados comerciales configurados */
export async function getPartnersAction() {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado', data: [] };

    const suppliers = await prisma.supplier.findMany({
        where: { supplierType: 'INTERCOMPANY' },
        include: {
            _count: { select: { intercompanyMenuItems: true } }
        },
        orderBy: { name: 'asc' }
    });

    const partners: PartnerSummary[] = suppliers.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        intercompanyCode: s.intercompanyCode,
        isActive: s.isActive,
        menuItemCount: s._count.intercompanyMenuItems
    }));

    return { success: true, message: '', data: partners };
}

/** Crea o actualiza un aliado comercial */
export async function upsertPartnerAction(data: {
    id?: string;
    name: string;
    code?: string;
    intercompanyCode?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    notes?: string;
}) {
    const session = await getSession();
    if (!session || !['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
        return { success: false, message: 'Sin permisos' };
    }

    if (data.id) {
        await prisma.supplier.update({
            where: { id: data.id },
            data: {
                name: data.name,
                code: data.code || null,
                intercompanyCode: data.intercompanyCode || null,
                contactName: data.contactName || null,
                phone: data.phone || null,
                email: data.email || null,
                notes: data.notes || null,
                supplierType: 'INTERCOMPANY',
            }
        });
    } else {
        await prisma.supplier.create({
            data: {
                name: data.name,
                code: data.code || null,
                intercompanyCode: data.intercompanyCode || null,
                contactName: data.contactName || null,
                phone: data.phone || null,
                email: data.email || null,
                notes: data.notes || null,
                supplierType: 'INTERCOMPANY',
                isActive: true,
            }
        });
    }

    revalidatePath('/dashboard/intercompany');
    return { success: true, message: 'Aliado guardado correctamente' };
}

/** Obtiene todos los items del menú con su estado intercompany */
export async function getMenuItemsWithPartnerAction() {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado', data: [] };

    const items = await prisma.menuItem.findMany({
        where: { isActive: true },
        select: {
            id: true,
            sku: true,
            name: true,
            price: true,
            isIntercompany: true,
            intercompanySupplierId: true,
            intercompanySupplier: { select: { id: true, name: true } },
            category: { select: { name: true } },
        },
        orderBy: [{ isIntercompany: 'desc' }, { category: { displayOrder: 'asc' } }, { name: 'asc' }]
    });

    return { success: true, message: '', data: items };
}

/** Asigna (o quita) el aliado comercial a un item del menú */
export async function setMenuItemPartnerAction(menuItemId: string, partnerId: string | null) {
    const session = await getSession();
    if (!session || !['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
        return { success: false, message: 'Sin permisos' };
    }

    await prisma.menuItem.update({
        where: { id: menuItemId },
        data: {
            isIntercompany: partnerId !== null,
            intercompanySupplierId: partnerId,
        }
    });

    revalidatePath('/dashboard/intercompany');
    revalidatePath('/dashboard/menu');
    return { success: true, message: 'Item actualizado' };
}

/** Asigna un aliado a múltiples items en bulk */
export async function bulkSetMenuItemPartnerAction(menuItemIds: string[], partnerId: string | null) {
    const session = await getSession();
    if (!session || !['OWNER', 'ADMIN_MANAGER'].includes(session.role)) {
        return { success: false, message: 'Sin permisos' };
    }

    await prisma.menuItem.updateMany({
        where: { id: { in: menuItemIds } },
        data: {
            isIntercompany: partnerId !== null,
            intercompanySupplierId: partnerId,
        }
    });

    revalidatePath('/dashboard/intercompany');
    return { success: true, message: `${menuItemIds.length} items actualizados` };
}

/** Reporte de ventas por aliado en un rango de fechas */
export async function getPartnerSalesReportAction(
    partnerId: string,
    periodStart: Date,
    periodEnd: Date
): Promise<{ success: boolean; message: string; data: PartnerSalesReport | null }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado', data: null };

    const partner = await prisma.supplier.findUnique({ where: { id: partnerId } });
    if (!partner) return { success: false, message: 'Aliado no encontrado', data: null };

    // Items de venta intercompany en el período
    const orderItems = await prisma.salesOrderItem.findMany({
        where: {
            intercompanySupplierId: partnerId,
            order: {
                status: { in: ['CONFIRMED', 'READY'] },
                createdAt: { gte: periodStart, lte: periodEnd }
            }
        },
        include: {
            order: {
                select: {
                    id: true,
                    paymentMethod: true,
                    total: true,
                    createdAt: true,
                    openTab: {
                        select: {
                            totalServiceCharge: true,
                            totalTip: true,
                            paymentSplits: {
                                select: {
                                    serviceChargeAmount: true,
                                    tipAmount: true,
                                    paymentMethod: true,
                                    paidAmount: true,
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Calcular totales
    const grossSales = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const uniqueOrderIds = new Set(orderItems.map(i => i.orderId));

    // Obtener el servicio proporcional desde los tabs
    // La proporción de ventas intercompany respecto al total de cada tab
    const tabIds = new Set<string>();
    const orderTotalsMap = new Map<string, number>(); // orderId -> total de esa orden

    for (const item of orderItems) {
        if (item.order.openTab) {
            tabIds.add(item.orderId); // usamos orderId como proxy
        }
        const cur = orderTotalsMap.get(item.orderId) || 0;
        orderTotalsMap.set(item.orderId, cur + item.lineTotal);
    }

    // Servicio y propina: no se puede separar por partner a nivel de PaymentSplit
    // Reportamos el total de servicio y propina de las cuentas donde hubo ventas intercompany
    // como referencia, pero la columna "owed" = grossSales (TP le debe al aliado el consumo sin servicio)
    const orderCount = uniqueOrderIds.size;

    // Top items
    const itemMap = new Map<string, { qty: number; total: number }>();
    for (const item of orderItems) {
        const existing = itemMap.get(item.itemName) || { qty: 0, total: 0 };
        itemMap.set(item.itemName, {
            qty: existing.qty + item.quantity,
            total: existing.total + item.lineTotal
        });
    }
    const topItems = Array.from(itemMap.entries())
        .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

    // Ventas por método de pago
    const methodMap = new Map<string, { count: number; total: number }>();
    for (const item of orderItems) {
        const method = item.order.paymentMethod || 'DESCONOCIDO';
        const existing = methodMap.get(method) || { count: 0, total: 0 };
        methodMap.set(method, { count: existing.count + 1, total: existing.total + item.lineTotal });
    }
    const salesByMethod = Array.from(methodMap.entries())
        .map(([method, v]) => ({ method, count: v.count, total: v.total }))
        .sort((a, b) => b.total - a.total);

    const report: PartnerSalesReport = {
        partnerId,
        partnerName: partner.name,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalGrossSales: Math.round(grossSales * 100) / 100,
        totalServiceCharge: 0, // se calcula en el resumen de cuenta, no por partner
        totalTip: 0,
        totalNetOwedToPartner: Math.round(grossSales * 100) / 100,
        orderCount,
        itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
        salesByMethod,
        topItems,
    };

    return { success: true, message: '', data: report };
}
