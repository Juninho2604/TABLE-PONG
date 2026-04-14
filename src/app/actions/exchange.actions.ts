'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';

export async function getCurrentExchangeRate() {
    const rate = await prisma.exchangeRate.findFirst({
        orderBy: { effectiveDate: 'desc' },
    });
    return rate;
}

export async function getExchangeRateForDisplay() {
    const rate = await getCurrentExchangeRate();
    if (!rate) return null;
    const roundedRate = Math.round(rate.rate * 100) / 100;
    return {
        rate: roundedRate,
        effectiveDate: rate.effectiveDate,
        source: rate.source,
        formatted: `1 USD = ${rate.rate.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`,
    };
}

/** Para uso en client components (POS, etc.) - devuelve solo el número de la tasa o null (redondeado a 2 decimales) */
export async function getExchangeRateValue(): Promise<number | null> {
    const rate = await getCurrentExchangeRate();
    return rate ? Math.round(rate.rate * 100) / 100 : null;
}

export async function setExchangeRateAction(rate: number, effectiveDate: Date) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    const ALLOWED_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER_RESTAURANT', 'CASHIER_DELIVERY'];
    if (!ALLOWED_ROLES.includes(session.role)) {
        return { success: false, message: 'Sin permisos para actualizar la tasa de cambio' };
    }

    if (rate <= 0) return { success: false, message: 'La tasa debe ser mayor a 0' };

    const roundedRate = Math.round(rate * 100) / 100;

    try {
        await prisma.exchangeRate.create({
            data: {
                rate: roundedRate,
                effectiveDate,
                source: 'BCV',
            },
        });
        await logAudit({
            userId: session.id,
            userName: `${session.firstName} ${session.lastName}`,
            userRole: session.role,
            action: 'UPDATE',
            entityType: 'ExchangeRate',
            entityId: `BCV-${effectiveDate.toISOString().slice(0, 10)}`,
            description: `Actualizó tasa de cambio BCV a ${roundedRate} Bs/USD`,
            module: 'CONFIG',
            metadata: { rate: roundedRate, effectiveDate },
        });
        revalidatePath('/dashboard/config/tasa-cambio');
        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/pos/sportbar');
        revalidatePath('/dashboard');
        return { success: true, message: 'Tasa actualizada correctamente' };
    } catch (error) {
        console.error('Error setting exchange rate:', error);
        return { success: false, message: 'Error al guardar la tasa' };
    }
}

export async function getExchangeRateHistory(limit = 10) {
    return prisma.exchangeRate.findMany({
        orderBy: { effectiveDate: 'desc' },
        take: limit,
    });
}
