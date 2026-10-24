'use server';

import prisma from '@/server/db';
import { createSession, deleteSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
    LOGIN_THROTTLE,
    clearThrottle,
    getLockMinutes,
    hashPassword,
    registerFailure,
    verifyPassword,
} from '@/lib/security';

const INVALID_CREDENTIALS = 'Email o contraseña incorrectos';

export async function loginAction(prevState: any, formData: FormData) {
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    if (!email || !password) {
        return { success: false, message: 'Falta email o contraseña' };
    }

    const throttleKey = `login:${email}`;

    try {
        const lock = await getLockMinutes(throttleKey);
        if (lock > 0) {
            return { success: false, message: `Demasiados intentos fallidos. Intenta en ${lock} min.` };
        }

        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
        });

        const { ok, needsRehash } = await verifyPassword(password, user?.passwordHash);

        // Mismo mensaje si el usuario no existe o la clave es incorrecta (no revelar emails)
        if (!user || !ok || user.deletedAt) {
            await registerFailure(throttleKey, LOGIN_THROTTLE);
            return { success: false, message: INVALID_CREDENTIALS };
        }

        if (!user.isActive) {
            return { success: false, message: 'Cuenta desactivada. Contacta al admin.' };
        }

        await clearThrottle(throttleKey);

        // Migración transparente: contraseñas legadas en texto plano pasan a bcrypt
        if (needsRehash) {
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: await hashPassword(password) },
            });
        }

        // Crear sesión segura
        await createSession({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        });

        // Redirección fuera del try-catch para que next/navigation funcione
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Error interno del servidor' };
    }

    redirect('/dashboard');
}

export async function logoutAction() {
    await deleteSession();
    redirect('/login');
}
