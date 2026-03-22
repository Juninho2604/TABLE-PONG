'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_EMAIL = 'admin@tablepong.com';

function canManageBroadcasts(email: string, role: string): boolean {
    return role === 'OWNER' || email.toLowerCase() === ADMIN_EMAIL;
}

export async function listActiveBroadcastsAction() {
    try {
        const session = await getSession();
        if (!session) return { success: false as const, message: 'No autorizado' };

        const rows = await prisma.broadcastMessage.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                createdBy: { select: { firstName: true, lastName: true, email: true } },
            },
        });

        return { success: true as const, data: rows };
    } catch (e) {
        console.error(e);
        return { success: false as const, message: 'Error cargando anuncios' };
    }
}

export async function createBroadcastAction(input: { title: string; body: string; kind?: string }) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        if (!canManageBroadcasts(session.email, session.role)) {
            return { success: false, message: 'Solo el dueño o admin@tablepong.com pueden publicar anuncios' };
        }
        const title = input.title?.trim();
        const body = input.body?.trim();
        if (!title || !body) return { success: false, message: 'Título y mensaje son obligatorios' };

        await prisma.broadcastMessage.create({
            data: {
                title,
                body,
                kind: input.kind || 'GENERAL',
                createdById: session.id,
            },
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/config/anuncios');
        return { success: true, message: 'Anuncio publicado' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Error al publicar' };
    }
}

export async function listAllBroadcastsAdminAction() {
    try {
        const session = await getSession();
        if (!session) return { success: false as const, message: 'No autorizado' };
        if (!canManageBroadcasts(session.email, session.role)) {
            return { success: false as const, message: 'Sin permisos' };
        }
        const rows = await prisma.broadcastMessage.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                createdBy: { select: { firstName: true, lastName: true, email: true } },
            },
        });
        return { success: true as const, data: rows };
    } catch (e) {
        console.error(e);
        return { success: false as const, message: 'Error' };
    }
}

export async function toggleBroadcastActiveAction(id: string, isActive: boolean) {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };
        if (!canManageBroadcasts(session.email, session.role)) {
            return { success: false, message: 'Sin permisos' };
        }

        await prisma.broadcastMessage.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath('/dashboard/config/anuncios');
        return { success: true, message: 'Actualizado' };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'Error' };
    }
}
