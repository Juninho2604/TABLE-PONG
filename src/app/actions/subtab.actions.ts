'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function closeZeroBalanceTabAction(openTabId: string): Promise<{
    success: boolean;
    message?: string;
}> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const tab = await prisma.openTab.findUnique({
        where: { id: openTabId },
        select: { balanceDue: true, status: true },
    });

    if (!tab) return { success: false, message: 'Cuenta no encontrada' };
    if (tab.balanceDue > 0.01) return { success: false, message: 'La cuenta tiene saldo pendiente' };
    if (tab.status === 'CLOSED') return { success: true };

    await prisma.openTab.update({
        where: { id: openTabId },
        data: { status: 'CLOSED', closedAt: new Date(), closedById: session.id },
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');
    return { success: true };
}

export async function createSubTabAction(data: {
    parentTabId: string;
    customerLabel: string;
    guestCount?: number;
}): Promise<{ success: boolean; message?: string; data?: any }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const parentTab = await prisma.openTab.findUnique({
        where: { id: data.parentTabId },
        select: {
            branchId: true,
            serviceZoneId: true,
            tableOrStationId: true,
            tableOrStation: { select: { id: true } },
        },
    });

    if (!parentTab) return { success: false, message: 'Cuenta principal no encontrada' };

    const existingSubTabs = await prisma.openTab.count({
        where: { parentTabId: data.parentTabId },
    });
    const splitIndex = existingSubTabs + 1;

    // Generar código único de subcuenta
    let subTab: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const tabCode = `SUB-${Date.now().toString(36).slice(-5).toUpperCase()}-${splitIndex}`;
            subTab = await prisma.openTab.create({
                data: {
                    branchId: parentTab.branchId,
                    serviceZoneId: parentTab.serviceZoneId,
                    tableOrStationId: parentTab.tableOrStationId,
                    tabCode,
                    customerLabel: data.customerLabel.trim(),
                    guestCount: data.guestCount || 1,
                    parentTabId: data.parentTabId,
                    splitIndex,
                    openedById: session.id,
                },
            });
            break;
        } catch (err: any) {
            if (err?.code === 'P2002') continue;
            throw err;
        }
    }

    if (!subTab) return { success: false, message: 'No se pudo crear la subcuenta' };

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');
    return { success: true, data: subTab };
}
