'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { getCaracasDateStamp } from '@/lib/datetime';
import { revalidatePath } from 'next/cache';

export async function getActiveCashSessionAction() {
    const session = await getSession();
    if (!session) return null;

    return prisma.cashSession.findFirst({
        where: { status: 'OPEN' },
        include: {
            openedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { openedAt: 'desc' },
    });
}

export async function openCashSessionAction(): Promise<{
    success: boolean;
    message?: string;
    data?: any;
}> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const existing = await prisma.cashSession.findFirst({ where: { status: 'OPEN' } });
    if (existing) return { success: true, data: existing };

    const businessDate = getCaracasDateStamp();
    const cashSession = await prisma.cashSession.create({
        data: {
            businessDate,
            status: 'OPEN',
            openedById: session.id,
        },
        include: {
            openedBy: { select: { id: true, firstName: true, lastName: true } },
        },
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');
    return { success: true, data: cashSession };
}

export async function closeCashSessionAction(): Promise<{
    success: boolean;
    message?: string;
}> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const cashSession = await prisma.cashSession.findFirst({ where: { status: 'OPEN' } });
    if (!cashSession) return { success: false, message: 'No hay sesión de caja activa' };

    await prisma.cashSession.update({
        where: { id: cashSession.id },
        data: { status: 'CLOSED', closedAt: new Date(), closedById: session.id },
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');
    return { success: true };
}
