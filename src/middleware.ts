import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

// Rutas accesibles sin sesión
const PUBLIC_PATHS = ['/', '/login', '/api/auth/session'];

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('session')?.value;
    const session = sessionCookie ? await decrypt(sessionCookie) : null;
    const path = request.nextUrl.pathname;
    const isPublic = PUBLIC_PATHS.includes(path);

    // 0. Server Actions: cualquier POST con cabecera Next-Action es un endpoint
    //    invocable directamente. Sin sesión solo se permite el login.
    if (request.headers.has('next-action') && !session && path !== '/login') {
        return new NextResponse('No autorizado', { status: 401 });
    }

    // 1. API: sesión obligatoria salvo endpoints públicos
    if (path.startsWith('/api') && !isPublic && !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Páginas protegidas: login requerido
    if ((path.startsWith('/dashboard') || path.startsWith('/kitchen')) && !session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3. Redirección Login -> Dashboard
    if (path.startsWith('/login') && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 4. Control de Accesos (RBAC)
    if (session) {
        const userRole = session.role;

        // A. Gestión de Usuarios: Solo Dueños y Gerentes Admin
        if (path.startsWith('/dashboard/usuarios')) {
            const allowed = ['OWNER', 'ADMIN_MANAGER'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_users', request.url));
            }
        }

        // B. Auditorías e Importación: Dueños, Gerentes, Auditores
        if (path.startsWith('/dashboard/inventario/auditorias') || path.startsWith('/dashboard/inventario/importar')) {
            const allowed = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_audit', request.url));
            }
        }

        // B2. Ciclos de inventario (cortes semanales / histórico)
        if (path.startsWith('/dashboard/inventario/ciclos')) {
            const allowed = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'AREA_LEAD'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_cycles', request.url));
            }
        }

        // C. Configuración Global (solo OWNER, salvo tasa-cambio que es también gerentes)
        if (path.startsWith('/dashboard/config/anuncios')) {
            const canAnuncios =
                userRole === 'OWNER' || session.email?.toLowerCase() === 'admin@tablepong.com';
            if (!canAnuncios) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_config', request.url));
            }
        } else if (path.startsWith('/dashboard/config/sku-studio')) {
            const canSkuStudio =
                userRole === 'OWNER' || session.email?.toLowerCase() === 'admin@tablepong.com';
            if (!canSkuStudio) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_config', request.url));
            }
        } else if (path.startsWith('/dashboard/config') && !path.startsWith('/dashboard/config/tasa-cambio')) {
            const allowed = ['OWNER'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_config', request.url));
            }
        }
        if (path.startsWith('/dashboard/config/tasa-cambio')) {
            const allowed = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'];
            if (!allowed.includes(userRole)) {
                return NextResponse.redirect(new URL('/dashboard?error=unauthorized_config', request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    // Todo excepto assets estáticos de Next
    matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
};
