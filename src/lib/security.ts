// Utilidades de seguridad del servidor: hash de contraseñas/PINs y freno de fuerza bruta.
// No usar desde componentes cliente.
import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/server/db';

// ============================================================================
// CONTRASEÑAS (bcrypt, con migración transparente desde texto plano)
// ============================================================================

const BCRYPT_ROUNDS = 10;

export function isBcryptHash(value: string | null | undefined): boolean {
    return !!value && /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}

/**
 * Verifica una contraseña. Si la almacenada aún está en texto plano (legado),
 * la compara en tiempo constante e indica que debe re-hashearse.
 */
export async function verifyPassword(
    plain: string,
    stored: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
    if (!stored || !plain) return { ok: false, needsRehash: false };
    if (isBcryptHash(stored)) {
        return { ok: await bcrypt.compare(plain, stored), needsRehash: false };
    }
    const ok = safeEqual(plain, stored);
    return { ok, needsRehash: ok };
}

// ============================================================================
// PINs (HMAC-SHA256 con pepper: determinista para poder buscar por PIN)
// ============================================================================

const PIN_PREFIX = 'h1:';

function getPinPepper(): string {
    const pepper = process.env.PIN_PEPPER || process.env.JWT_SECRET;
    if (!pepper || pepper.length < 32) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('PIN_PEPPER ausente o débil (mínimo 32 caracteres)');
        }
        return 'dev-only-insecure-pin-pepper-change-me-00';
    }
    return pepper;
}

export function hashPin(pin: string): string {
    return PIN_PREFIX + createHmac('sha256', getPinPepper()).update(pin.trim()).digest('hex');
}

export function isHashedPin(value: string | null | undefined): boolean {
    return !!value && value.startsWith(PIN_PREFIX);
}

/** Valores a buscar en BD para un PIN: hash nuevo + texto plano legado. */
export function pinLookupValues(pin: string): string[] {
    const clean = pin.trim();
    return [hashPin(clean), clean];
}

/** Si el usuario encontrado aún tenía el PIN en texto plano, lo migra al hash. */
export async function upgradePinIfLegacy(userId: string, storedPin: string | null | undefined, pin: string) {
    if (storedPin && !isHashedPin(storedPin)) {
        await prisma.user.update({ where: { id: userId }, data: { pin: hashPin(pin) } }).catch(() => {});
    }
}

// ============================================================================
// FRENO DE FUERZA BRUTA (persistido en BD, funciona en serverless)
// ============================================================================

interface ThrottleOptions {
    maxAttempts: number; // intentos fallidos permitidos en la ventana
    windowMs: number;    // ventana de conteo
    lockMs: number;      // bloqueo al superar el máximo
}

export const LOGIN_THROTTLE: ThrottleOptions = { maxAttempts: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const PIN_THROTTLE: ThrottleOptions = { maxAttempts: 5, windowMs: 10 * 60_000, lockMs: 10 * 60_000 };

/** Devuelve los minutos restantes de bloqueo, o 0 si puede intentar. */
export async function getLockMinutes(key: string): Promise<number> {
    const row = await prisma.authThrottle.findUnique({ where: { key } });
    if (!row?.lockedUntil) return 0;
    const ms = row.lockedUntil.getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

export async function registerFailure(key: string, opts: ThrottleOptions): Promise<void> {
    const now = new Date();
    const row = await prisma.authThrottle.findUnique({ where: { key } });
    const windowExpired = !row || now.getTime() - row.windowStart.getTime() > opts.windowMs;
    const count = windowExpired ? 1 : row!.count + 1;
    const lockedUntil = count >= opts.maxAttempts ? new Date(now.getTime() + opts.lockMs) : null;
    await prisma.authThrottle.upsert({
        where: { key },
        create: { key, count, windowStart: now, lockedUntil },
        update: {
            count: lockedUntil ? 0 : count,
            windowStart: windowExpired || lockedUntil ? now : row!.windowStart,
            lockedUntil,
        },
    });
}

export async function clearThrottle(key: string): Promise<void> {
    await prisma.authThrottle.deleteMany({ where: { key } });
}

// ============================================================================
// VERIFICACIÓN DE PIN DE AUTORIZACIÓN (supervisor/gerente)
// ============================================================================

/**
 * Busca un usuario activo cuyo PIN coincida, aplicando límite de intentos
 * por usuario que solicita (actorId). Migra PINs legados al hash.
 */
export async function verifyAuthorizerPin<T extends { id: string; pin: string | null }>(
    actorId: string,
    pin: string,
    find: (pinValues: string[]) => Promise<T | null>,
): Promise<{ ok: true; user: T } | { ok: false; message: string }> {
    const clean = (pin || '').trim();
    if (!clean) return { ok: false, message: 'PIN requerido' };

    const key = `pin:${actorId}`;
    const lock = await getLockMinutes(key);
    if (lock > 0) return { ok: false, message: `Demasiados intentos. Espera ${lock} min.` };

    const user = await find(pinLookupValues(clean));
    if (!user) {
        await registerFailure(key, PIN_THROTTLE);
        return { ok: false, message: 'PIN inválido' };
    }
    await clearThrottle(key);
    await upgradePinIfLegacy(user.id, user.pin, clean);
    return { ok: true, user };
}
