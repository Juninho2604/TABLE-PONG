'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface CustomerRecord {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    visitCount: number;
    lastVisitAt: Date | null;
}

// ── Buscar clientes por nombre o teléfono ─────────────────────────────────────
export async function searchCustomersAction(query: string): Promise<{ success: boolean; data?: CustomerRecord[]; message?: string }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const q = query.trim();
    if (!q) {
        // Sin query: devolver los 10 más frecuentes
        const customers = await prisma.customer.findMany({
            where: { isActive: true },
            orderBy: [{ visitCount: 'desc' }, { lastVisitAt: 'desc' }],
            take: 10,
            select: { id: true, name: true, phone: true, email: true, notes: true, visitCount: true, lastVisitAt: true },
        });
        return { success: true, data: customers };
    }

    const customers = await prisma.customer.findMany({
        where: {
            isActive: true,
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
            ],
        },
        orderBy: [{ visitCount: 'desc' }, { name: 'asc' }],
        take: 10,
        select: { id: true, name: true, phone: true, email: true, notes: true, visitCount: true, lastVisitAt: true },
    });

    return { success: true, data: customers };
}

// ── Crear cliente nuevo ────────────────────────────────────────────────────────
export async function createCustomerAction(data: {
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
}): Promise<{ success: boolean; data?: CustomerRecord; message?: string }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const name = data.name.trim();
    if (!name) return { success: false, message: 'El nombre es obligatorio' };

    const phone = data.phone?.trim() || null;

    // Evitar duplicado por teléfono
    if (phone) {
        const existing = await prisma.customer.findUnique({ where: { phone } });
        if (existing) {
            return { success: true, data: existing, message: 'Cliente ya existe con ese teléfono' };
        }
    }

    const customer = await prisma.customer.create({
        data: {
            name,
            phone: phone || undefined,
            email: data.email?.trim() || undefined,
            notes: data.notes?.trim() || undefined,
        },
        select: { id: true, name: true, phone: true, email: true, notes: true, visitCount: true, lastVisitAt: true },
    });

    revalidatePath('/dashboard/pos/restaurante');
    return { success: true, data: customer };
}

// ── Registrar visita (incrementar contador al cobrar) ─────────────────────────
export async function recordCustomerVisitAction(customerId: string): Promise<void> {
    await prisma.customer.update({
        where: { id: customerId },
        data: {
            visitCount: { increment: 1 },
            lastVisitAt: new Date(),
        },
    });
}

// ── Actualizar datos del cliente ───────────────────────────────────────────────
export async function updateCustomerAction(id: string, data: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
}): Promise<{ success: boolean; data?: CustomerRecord; message?: string }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const customer = await prisma.customer.update({
        where: { id },
        data: {
            ...(data.name ? { name: data.name.trim() } : {}),
            ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
            ...(data.email !== undefined ? { email: data.email.trim() || null } : {}),
            ...(data.notes !== undefined ? { notes: data.notes.trim() || null } : {}),
        },
        select: { id: true, name: true, phone: true, email: true, notes: true, visitCount: true, lastVisitAt: true },
    });

    return { success: true, data: customer };
}
