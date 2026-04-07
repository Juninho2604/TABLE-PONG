'use server';

import { prisma } from '@/server/db'; // Correct path from previous files
import { getSession, hasPermission, PERMISSIONS } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit-log';

/**
 * Obtiene la lista de todos los usuarios
 */
export async function getUsers() {
    const session = await getSession();

    // Validar sesión
    if (!session) {
        throw new Error('No autorizado');
    }

    // Validar permisos (Solo Gerentes o superior pueden ver lista de usuarios para config)
    if (!hasPermission(session.role, PERMISSIONS.VIEW_USERS)) {
        throw new Error('No tienes permisos para ver la lista de usuarios');
    }

    const users = await prisma.user.findMany({
        orderBy: {
            lastName: 'asc',
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true, // Útil para la gestión
        },
    });

    return users;
}

/**
 * Actualiza el rol de un usuario
 */
export async function updateUserRole(userId: string, newRole: string) {
    const session = await getSession();

    if (!session) {
        return { success: false, message: 'No autenticado' };
    }

    if (!hasPermission(session.role, PERMISSIONS.CONFIGURE_ROLES)) {
        return { success: false, message: 'No tienes permisos para cambiar roles' };
    }

    // Evitar que se cambie su propio rol para no quedarse fuera inadvertidamente,
    // o al menos advertir (aquí lo permitimos pero el frontend podría validarlo)

    try {
        const userBefore = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, firstName: true, lastName: true } });

        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole as any }, // Cast as any or import UserRole enum if available
        });

        await logAudit({
            userId: session.id,
            userName: `${session.firstName || ''} ${session.lastName || ''}`.trim(),
            userRole: session.role,
            action: 'UPDATE',
            entityType: 'User',
            entityId: userId,
            description: `Cambió rol de ${userBefore?.firstName} ${userBefore?.lastName}: ${userBefore?.role} → ${newRole}`,
            module: 'USER',
            changes: { role: { from: userBefore?.role, to: newRole } },
        });

        revalidatePath('/dashboard/config/roles');
        return { success: true, message: 'Rol actualizado correctamente' };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, message: 'Error al actualizar el rol' };
    }
}

/**
 * Activar/Desactivar usuarios (Bonus)
 */
export async function toggleUserStatus(userId: string, isActive: boolean) {
    const session = await getSession();

    if (!session) {
        return { success: false, message: 'No autenticado' };
    }

    if (!hasPermission(session.role, PERMISSIONS.CONFIGURE_ROLES)) {
        return { success: false, message: 'No tienes permisos para gestionar usuarios' };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });

        await prisma.user.update({
            where: { id: userId },
            data: { isActive },
        });

        await logAudit({
            userId: session.id,
            userName: `${session.firstName || ''} ${session.lastName || ''}`.trim(),
            userRole: session.role,
            action: isActive ? 'UPDATE' : 'DELETE',
            entityType: 'User',
            entityId: userId,
            description: `${isActive ? 'Activó' : 'Desactivó'} usuario: ${user?.firstName} ${user?.lastName}`,
            module: 'USER',
            changes: { isActive: { from: !isActive, to: isActive } },
        });

        revalidatePath('/dashboard/config/roles');
        return { success: true, message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente` };
    } catch (error) {
        console.error('Error toggling user status:', error);
        return { success: false, message: 'Error al cambiar estado del usuario' };
    }
}

/**
 * Crear nuevo usuario (solo OWNER y ADMIN_MANAGER)
 */
export async function createUserAction(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    password: string;
    pin?: string;
}) {
    const session = await getSession();

    if (!session) {
        return { success: false, message: 'No autenticado' };
    }

    if (!hasPermission(session.role, PERMISSIONS.MANAGE_USERS)) {
        return { success: false, message: 'No tienes permisos para crear usuarios' };
    }

    const { email, firstName, lastName, role, password, pin } = data;
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !firstName?.trim() || !lastName?.trim() || !role || !password) {
        return { success: false, message: 'Completa todos los campos obligatorios' };
    }

    if (password.length < 6) {
        return { success: false, message: 'La contraseña debe tener al menos 6 caracteres' };
    }

    if (!emailTrim.endsWith('@tablepong.com')) {
        return { success: false, message: 'El email debe ser @tablepong.com' };
    }

    try {
        const existing = await prisma.user.findUnique({
            where: { email: emailTrim },
        });
        if (existing) {
            return { success: false, message: 'Ya existe un usuario con ese email' };
        }

        await prisma.user.create({
            data: {
                email: emailTrim,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                role: role as any,
                passwordHash: password,
                pin: pin?.trim() || null,
            },
        });

        await logAudit({
            userId: session.id,
            userName: `${session.firstName || ''} ${session.lastName || ''}`.trim(),
            userRole: session.role,
            action: 'CREATE',
            entityType: 'User',
            entityId: emailTrim,
            description: `Creó usuario: ${firstName} ${lastName} (${emailTrim}) — Rol: ${role}`,
            module: 'USER',
            metadata: { email: emailTrim, role },
        });

        revalidatePath('/dashboard/usuarios');
        revalidatePath('/dashboard/config/roles');
        return { success: true, message: 'Usuario creado correctamente' };
    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, message: 'Error al crear el usuario' };
    }
}

/**
 * Obtiene todos los usuarios con su campo allowedModules (solo OWNER)
 */
export async function getUsersWithModules() {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        throw new Error('No autorizado');
    }

    return prisma.user.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            allowedModules: true,
        },
    });
}

/**
 * Actualiza los módulos permitidos de un usuario (solo OWNER)
 * modules: null = acceso por rol; array vacío = sin acceso; array = módulos específicos
 */
export async function updateUserModulesAction(userId: string, modules: string[] | null) {
    const session = await getSession();
    if (!session || session.role !== 'OWNER') {
        return { success: false, message: 'No autorizado' };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { allowedModules: modules === null ? null : JSON.stringify(modules) },
        });
        revalidatePath('/dashboard/config/modulos');
        return { success: true, message: 'Módulos actualizados correctamente' };
    } catch (error) {
        console.error('Error updating user modules:', error);
        return { success: false, message: 'Error al actualizar módulos' };
    }
}

/**
 * Cambiar contraseña del usuario actual
 */
export async function changePasswordAction(currentPassword: string, newPassword: string) {
    const session = await getSession();

    if (!session?.id) {
        return { success: false, message: 'No autorizado' };
    }

    try {
        // 1. Obtener usuario actual
        const user = await prisma.user.findUnique({
            where: { id: session.id },
        });

        if (!user) {
            return { success: false, message: 'Usuario no encontrado' };
        }

        // 2. Verificar contraseña actual (Comparación simple por ahora, igual que login)
        if (user.passwordHash !== currentPassword) {
            return { success: false, message: 'La contraseña actual es incorrecta' };
        }

        // 3. Validar nueva contraseña (longitud mínima)
        if (newPassword.length < 6) {
            return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' };
        }

        // 4. Actualizar contraseña
        await prisma.user.update({
            where: { id: session.id },
            data: { passwordHash: newPassword },
        });

        return { success: true, message: 'Contraseña actualizada correctamente' };

    } catch (error) {
        console.error('Error changing password:', error);
        return { success: false, message: 'Error al cambiar la contraseña' };
    }
}
