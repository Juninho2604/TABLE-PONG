'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function getAreasForConfig() {
    const session = await getSession();
    if (!session) throw new Error('No autorizado');

    return prisma.area.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, description: true, isActive: true },
    });
}

export async function createAreaAction(name: string, description?: string) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!hasPermission(session.role, PERMISSIONS.MANAGE_USERS)) return { success: false, message: 'Sin permisos para crear almacenes' };

    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return { success: false, message: 'El nombre es obligatorio' };

    try {
        const existing = await prisma.area.findFirst({
            where: { name: { equals: trimmed, mode: 'insensitive' } },
        });
        if (existing) return { success: false, message: 'Ya existe un almacén con ese nombre' };

        await prisma.area.create({
            data: { name: trimmed, description: description?.trim() || null },
        });

        revalidatePath('/dashboard/almacenes');
        revalidatePath('/dashboard/inventario');
        revalidatePath('/dashboard/transferencias');
        return { success: true, message: 'Almacén creado correctamente' };
    } catch (error) {
        console.error('Error creating area:', error);
        return { success: false, message: 'Error al crear el almacén' };
    }
}

export async function toggleAreaStatusAction(id: string, isActive: boolean) {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };
    if (!hasPermission(session.role, PERMISSIONS.MANAGE_USERS)) return { success: false, message: 'Sin permisos' };

    try {
        await prisma.area.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath('/dashboard/almacenes');
        revalidatePath('/dashboard/inventario');
        return { success: true, message: isActive ? 'Almacén activado' : 'Almacén desactivado' };
    } catch (error) {
        console.error('Error toggling area:', error);
        return { success: false, message: 'Error al cambiar estado' };
    }
}
