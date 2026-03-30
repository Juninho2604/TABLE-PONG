'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

// ============================================================================
// PRE-BILL & ANTI-FRAUDE ACTIONS
// ============================================================================

/**
 * Registra una impresión de "Estado de Cuenta" (pre-bill).
 * Retorna el contador actualizado. Si count > 2, la UI debe disparar alerta WA.
 */
export async function incrementPreBillPrintAction(tabId: string) {
    const session = await getSession();
    if (!session?.id) return { success: false as const, count: 0, message: 'No autorizado' };

    try {
        const tab = await prisma.openTab.update({
            where: { id: tabId },
            data: { preBillPrintCount: { increment: 1 } },
            select: {
                preBillPrintCount: true,
                tabCode: true,
                customerLabel: true,
                balanceDue: true,
                tableOrStation: { select: { name: true } },
            },
        });

        // Log forense en AuditLog (siempre)
        await prisma.auditLog.create({
            data: {
                userId: session.id,
                userName: `${session.firstName || ''} ${session.lastName || ''}`.trim(),
                userRole: session.role,
                action: 'PRINT',
                entityType: 'OpenTab',
                entityId: tabId,
                description: `Estado de Cuenta impreso (${tab.preBillPrintCount}ª vez) — ${tab.tabCode} — $${tab.balanceDue.toFixed(2)}`,
                module: 'POS',
                metadata: JSON.stringify({
                    printCount: tab.preBillPrintCount,
                    balance: tab.balanceDue,
                    table: tab.tableOrStation?.name,
                }),
            },
        });

        return {
            success: true as const,
            count: tab.preBillPrintCount,
            tabCode: tab.tabCode,
            balance: tab.balanceDue,
            tableName: tab.tableOrStation?.name,
            isAlert: tab.preBillPrintCount > 2, // Disparar alerta WA si > 2
        };
    } catch (error) {
        console.error('Error incrementPreBillPrint:', error);
        return { success: false as const, count: 0, message: 'Error al registrar impresión' };
    }
}

/**
 * Resetea el contador de pre-bill cuando la cuenta se cierra/cobra.
 * Se llama automáticamente desde registerOpenTabPaymentAction al cerrar.
 */
export async function resetPreBillPrintCountAction(tabId: string) {
    try {
        await prisma.openTab.update({
            where: { id: tabId },
            data: { preBillPrintCount: 0 },
        });
        return { success: true };
    } catch {
        return { success: false };
    }
}

// ============================================================================
// BLIND CLOSE — CIERRE CIEGO
// ============================================================================

export interface BlindCloseSummary {
    date: string;
    byMethod: Record<string, {
        expected: number;
        transactions: number;
        label: string;
    }>;
    totalExpected: number;
    cortesias: number;
    divisasTransactions: number;
}

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo (USD)',
    ZELLE: 'Zelle',
    CARD: 'Tarjeta',
    MOBILE_PAY: 'Pago Móvil (Bs)',
    TRANSFER: 'Transferencia',
    MULTIPLE: 'Mixto',
};

export async function getShiftSummaryForBlindCloseAction(date?: string): Promise<{
    success: boolean;
    data?: BlindCloseSummary;
    message?: string;
}> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    const allowedRoles = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
    if (!allowedRoles.includes(session.role)) {
        return { success: false, message: 'Solo Gerencia puede ver el cierre ciego' };
    }

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        // Payment splits de cuentas de mesa
        const splits = await prisma.paymentSplit.findMany({
            where: {
                paidAt: { gte: startOfDay, lte: endOfDay },
                status: 'PAID',
            },
            select: {
                paymentMethod: true,
                paidAmount: true,
            },
        });

        // Ventas directas (pickup)
        const directSales = await prisma.salesOrder.findMany({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                paymentStatus: 'PAID',
                serviceFlow: 'DIRECT_SALE',
                deletedAt: null,
            },
            select: {
                paymentMethod: true,
                amountPaid: true,
                total: true,
                discountType: true,
            },
        });

        // Cortesías del día (para el reporte)
        const cortesias = await prisma.salesOrder.count({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                discountType: { in: ['CORTESIA_100', 'CORTESIA_PERCENT'] },
                deletedAt: null,
            },
        });

        const byMethod: BlindCloseSummary['byMethod'] = {};

        for (const split of splits) {
            const m = split.paymentMethod || 'UNKNOWN';
            if (!byMethod[m]) byMethod[m] = { expected: 0, transactions: 0, label: METHOD_LABELS[m] || m };
            byMethod[m].expected += split.paidAmount;
            byMethod[m].transactions++;
        }

        for (const sale of directSales) {
            const m = sale.paymentMethod || 'UNKNOWN';
            if (!byMethod[m]) byMethod[m] = { expected: 0, transactions: 0, label: METHOD_LABELS[m] || m };
            byMethod[m].expected += sale.amountPaid ?? sale.total;
            byMethod[m].transactions++;
        }

        const totalExpected = Object.values(byMethod).reduce((s, v) => s + v.expected, 0);
        const divisasTransactions = (byMethod['CASH']?.transactions || 0) + (byMethod['ZELLE']?.transactions || 0);

        return {
            success: true,
            data: {
                date: targetDate.toISOString(),
                byMethod,
                totalExpected,
                cortesias,
                divisasTransactions,
            },
        };
    } catch (error) {
        console.error('Error getShiftSummary:', error);
        return { success: false, message: 'Error al obtener resumen de turno' };
    }
}

/**
 * Registra el conteo físico declarado por la cajera (cierre ciego).
 * Persiste en AuditLog la discrepancia para supervisión gerencial.
 */
export async function submitBlindCloseDeclarationAction(input: {
    date: string;
    declared: Record<string, number>; // { CASH: 150.00, ZELLE: 80.00, ... }
    expected: Record<string, number>;
    cashierNotes?: string;
}) {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    const discrepancies: Record<string, { declared: number; expected: number; diff: number }> = {};
    let hasDiscrepancy = false;

    for (const [method, declaredAmt] of Object.entries(input.declared)) {
        const expectedAmt = input.expected[method] || 0;
        const diff = declaredAmt - expectedAmt;
        discrepancies[method] = { declared: declaredAmt, expected: expectedAmt, diff };
        if (Math.abs(diff) > 0.01) hasDiscrepancy = true;
    }

    await prisma.auditLog.create({
        data: {
            userId: session.id,
            userName: `${session.firstName || ''} ${session.lastName || ''}`.trim(),
            userRole: session.role,
            action: 'BLIND_CLOSE',
            entityType: 'ShiftClose',
            entityId: input.date,
            description: hasDiscrepancy
                ? `⚠️ CIERRE CIEGO CON DISCREPANCIA — ${session.firstName}`
                : `Cierre ciego sin discrepancias — ${session.firstName}`,
            changes: JSON.stringify(discrepancies),
            metadata: JSON.stringify({ cashierNotes: input.cashierNotes, date: input.date }),
            module: 'POS',
        },
    });

    return {
        success: true,
        hasDiscrepancy,
        discrepancies,
    };
}
