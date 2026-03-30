'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { getCaracasDateStamp } from '@/lib/datetime';
import { revalidatePath } from 'next/cache';

const AUTHORIZED_OPEN_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER_RESTAURANT', 'AREA_LEAD'];

export async function getActiveCashSessionAction() {
    const session = await prisma.cashSession.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
        include: {
            openedBy: { select: { firstName: true, lastName: true, role: true } }
        }
    });
    return session;
}

export async function openCashSessionAction(notes?: string): Promise<{ success: boolean; message: string; data?: any }> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    if (!AUTHORIZED_OPEN_ROLES.includes(session.role)) {
        return { success: false, message: 'Solo gerentes y cajeros pueden abrir la caja.' };
    }

    // Si ya hay una sesión abierta, devolver esa (no crear duplicado)
    const existing = await prisma.cashSession.findFirst({ where: { status: 'OPEN' } });
    if (existing) {
        return { success: true, message: 'La caja ya estaba abierta.', data: existing };
    }

    const businessDate = getCaracasDateStamp();
    const newSession = await prisma.cashSession.create({
        data: {
            businessDate,
            openedById: session.id,
            status: 'OPEN',
            notes: notes?.trim() || null,
        },
        include: {
            openedBy: { select: { firstName: true, lastName: true, role: true } }
        }
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');
    revalidatePath('/dashboard/pos/mesero');
    revalidatePath('/dashboard/pos/delivery');

    return {
        success: true,
        message: `Caja abierta — Día de facturación: ${businessDate}`,
        data: newSession
    };
}

export async function closeCashSessionAction(
    notes?: string,
    managerPin?: string
): Promise<{ success: boolean; message: string }> {
    const session = await getSession();
    if (!session?.id) return { success: false, message: 'No autorizado' };

    const activeSession = await prisma.cashSession.findFirst({ where: { status: 'OPEN' } });
    if (!activeSession) return { success: false, message: 'No hay caja abierta.' };

    // Si quien cierra NO es quien abrió Y no es gerente senior, requiere PIN
    const isSeniorManager = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'].includes(session.role);
    const isOwner = activeSession.openedById === session.id;

    if (!isOwner && !isSeniorManager) {
        if (!managerPin) {
            return { success: false, message: 'Se requiere PIN de gerente para cerrar una caja abierta por otro usuario.' };
        }
        const manager = await prisma.user.findFirst({
            where: { pin: managerPin, role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] }, isActive: true }
        });
        if (!manager) return { success: false, message: 'PIN de gerente inválido.' };
    }

    await prisma.cashSession.update({
        where: { id: activeSession.id },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedById: session.id,
            notes: notes?.trim() || activeSession.notes
        }
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/sportbar');
    revalidatePath('/dashboard/pos/mesero');

    return { success: true, message: 'Caja cerrada exitosamente.' };
}
