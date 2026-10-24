import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Secreto antiguo que estuvo publicado en el código: nunca se acepta.
const LEAKED_DEFAULT_SECRET = 'shanklish-super-secret-key-2024';

function getKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === LEAKED_DEFAULT_SECRET || secret.length < 32) {
        if (process.env.NODE_ENV === 'production') {
            // Fail-closed: sin un secreto fuerte no se emiten ni aceptan sesiones
            throw new Error('JWT_SECRET ausente o débil (mínimo 32 caracteres)');
        }
        return new TextEncoder().encode('dev-only-insecure-secret-change-me-0000');
    }
    return new TextEncoder().encode(secret);
}

interface SessionPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    // Permisos adicionales si los implementamos
}

export async function encrypt(payload: SessionPayload) {
    return await new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime("12h") // Sesiones de 12 horas (un turno)
        .sign(getKey());
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(input, getKey(), {
            algorithms: ['HS256'],
        });
        return payload as unknown as SessionPayload;
    } catch (error) {
        return null;
    }
}

export async function getSession() {
    const sessionCookie = (await cookies()).get('session')?.value;
    if (!sessionCookie) return null;
    return await decrypt(sessionCookie);
}

export async function createSession(payload: SessionPayload) {
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 horas
    const session = await encrypt(payload);

    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
}

export async function deleteSession() {
    (await cookies()).delete('session');
}

// === UTILIDADES DE PERMISOS ===


// Exportar desde el archivo separado para evitar conflictos en cliente
export { hasPermission, PERMISSIONS } from './permissions';

