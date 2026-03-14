'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { ROLE_INFO } from '@/lib/constants/roles';
import { UserRole } from '@/types';
import { logoutAction } from '@/app/actions/auth.actions';
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog';

interface NavItem {
    label: string;
    href: string;
    icon: string;
    roles?: UserRole[]; // Si no se especifica, todos pueden ver
    archived?: boolean; // Si true, no se muestra en el menú (para pruebas futuras)
}

const navigation: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: '📊',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER', 'CHEF', 'AREA_LEAD'] // Todos MENOS Cajeras
    },
    {
        label: 'Inventario Diario',
        href: '/dashboard/inventario/diario',
        icon: '📅',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD']
    },
    {
        label: 'Inventario',
        href: '/dashboard/inventario',
        icon: '📦',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD']
    },
    {
        label: 'Auditorías',
        href: '/dashboard/inventario/auditorias',
        icon: '📝',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD']
    },
    {
        label: 'Transferencias',
        href: '/dashboard/transferencias',
        icon: '🔄',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD']
    },
    {
        label: 'Historial Mensual',
        href: '/dashboard/inventario/historial-mensual',
        icon: '📊',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER']
    },
    {
        label: 'Préstamos',
        href: '/dashboard/prestamos',
        icon: '🤝',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER']
    },
    {
        label: 'Recetas',
        href: '/dashboard/recetas',
        icon: '📋',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF']
    },
    {
        label: 'Producción',
        href: '/dashboard/produccion',
        icon: '🏭',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD']
    },
    {
        label: 'Costos',
        href: '/dashboard/costos',
        icon: '💰',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER'],
    },
    {
        label: 'Compras',
        href: '/dashboard/compras',
        icon: '🛒',
        roles: ['OWNER', 'AUDITOR', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CHEF', 'AREA_LEAD'],
    },
    {
        label: 'Menú',
        href: '/dashboard/menu',
        icon: '🍽️',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
    },
];

// Navegación POS (archived = oculto por ahora, para pruebas futuras)
const posNavigation: NavItem[] = [
    {
        label: 'POS Sport Bar',
        href: '/dashboard/pos/sportbar',
        icon: '🍺',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER_RESTAURANT', 'AREA_LEAD', 'CHEF'],
    },
    {
        label: 'POS Restaurante',
        href: '/dashboard/pos/restaurante',
        icon: '🥙',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER_RESTAURANT'],
    },
    {
        label: 'POS Delivery',
        href: '/dashboard/pos/delivery',
        icon: '🛵',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER_DELIVERY'],
    },
    {
        label: 'Cargar Ventas',
        href: '/dashboard/ventas/cargar',
        icon: '💳',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR'],
    },
    {
        label: 'Historial Ventas',
        href: '/dashboard/sales',
        icon: '📈',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'CHEF'],
    },
    {
        label: 'Comandera Cocina',
        href: '/kitchen',
        icon: '👨‍🍳',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'KITCHEN_CHEF'],
    },
    {
        label: 'Menú',
        href: '/dashboard/menu',
        icon: '🍽️',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'],
    },
];

const secondaryNavigation: NavItem[] = [
    {
        label: 'Usuarios',
        href: '/dashboard/usuarios',
        icon: '👥',
        roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'HR_MANAGER', 'AUDITOR'],
    },
    { label: 'Roles y Permisos', href: '/dashboard/config/roles', icon: '⚙️', roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
    { label: 'Almacenes', href: '/dashboard/almacenes', icon: '📦', roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
    { label: 'Tasa de Cambio', href: '/dashboard/config/tasa-cambio', icon: '💱', roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
    { label: 'Módulos por Usuario', href: '/dashboard/config/modulos', icon: '🔧', roles: ['OWNER'] },
];


interface SidebarProps {
    initialUser?: any; // SessionPayload
    allowedModules?: string[] | null; // null = use role-based; array = override
}

export function Sidebar({ initialUser, allowedModules }: SidebarProps) {
    const pathname = usePathname();
    const { user, login } = useAuthStore();
    const { sidebarOpen, closeSidebar } = useUIStore();

    // Sincronizar usuario real con el store al montar
    useEffect(() => {
        if (initialUser && (!user || initialUser.id !== user.id)) {
            login({
                id: initialUser.id,
                email: initialUser.email,
                firstName: initialUser.firstName,
                lastName: initialUser.lastName,
                role: initialUser.role as UserRole,
            });
        }
    }, [initialUser, login, user]);

    // Cerrar sidebar al cambiar de ruta (para móvil)
    useEffect(() => {
        closeSidebar();
    }, [pathname, closeSidebar]);

    // Usar el usuario del store (que ahora está sincronizado)
    const activeUser = user || (initialUser as any);
    const userRole = activeUser?.role as UserRole;

    // Helper: check if item passes module override (if set) AND role filter
    const isAllowed = (item: NavItem) => {
        const passesRole = !item.roles || (userRole && item.roles.includes(userRole));
        if (!passesRole) return false;
        // If allowedModules is set (non-null array), the item's href must be included
        if (allowedModules !== null && allowedModules !== undefined) {
            return allowedModules.includes(item.href);
        }
        return true;
    };

    // Filtrar navegación según rol del usuario
    const filteredNav = navigation.filter(isAllowed);
    const filteredPosNav = posNavigation.filter(item => !item.archived && isAllowed(item));
    const filteredSecondaryNav = secondaryNavigation.filter(isAllowed);

    const roleInfo = userRole ? ROLE_INFO[userRole] : null;

    return (
        <>
            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-700 dark:bg-gray-900",
                    // Mobile: hidden by default, show when open
                    sidebarOpen ? "translate-x-0" : "-translate-x-full",
                    // Desktop: always visible
                    "md:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6 dark:border-gray-700">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25">
                        <span className="text-xl">🏓</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-900 dark:text-white">Table Pong</h1>
                        <p className="text-xs text-gray-500">ERP Sport Bar</p>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={closeSidebar}
                        className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden dark:hover:bg-gray-800"
                        aria-label="Cerrar menú"
                    >
                        ✕
                    </button>
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                    <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Operaciones
                    </p>
                    {filteredNav.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={closeSidebar}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                                    isActive
                                        ? 'bg-primary/10 text-primary dark:text-primary'
                                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                )}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                                {isActive && (
                                    <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                                )}
                            </Link>
                        );
                    })}

                    {filteredPosNav.length > 0 && (
                        <>
                            <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
                            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Ventas
                            </p>
                            {filteredPosNav.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={closeSidebar}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                                            isActive
                                                ? 'bg-primary/10 text-primary dark:text-primary'
                                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                        )}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        {item.label}
                                        {isActive && (
                                            <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </Link>
                                );
                            })}
                        </>
                    )}

                    {filteredSecondaryNav.length > 0 && (
                        <>
                            <div className="my-4 border-t border-gray-200 dark:border-gray-700" />
                            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Administración
                            </p>
                            {filteredSecondaryNav.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={closeSidebar}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                                            isActive
                                                ? 'bg-primary/10 text-primary dark:text-primary'
                                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                        )}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </>
                    )}
                </nav>

                {/* User Info */}
                <div className="border-t border-gray-200 p-4 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-lg dark:from-gray-600 dark:to-gray-700">
                            👤
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                {activeUser?.firstName} {activeUser?.lastName}
                            </p>
                            {roleInfo && (
                                <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                    style={{
                                        backgroundColor: `${roleInfo.color}20`,
                                        color: roleInfo.color,
                                    }}
                                >
                                    {roleInfo.labelEs}
                                </span>
                            )}
                        </div>

                        <ChangePasswordDialog />

                        {/* Botón Logout */}
                        <form action={logoutAction}>
                            <button
                                type="submit"
                                title="Cerrar Sesión"
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                            >
                                🚪
                            </button>
                        </form>
                    </div>
                </div>
            </aside>
        </>
    );
}
