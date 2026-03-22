'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { DashboardNotifications } from '@/components/layout/DashboardNotifications';

type SessionUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
};

interface NavbarProps {
    initialUser?: SessionUser | null;
}

export function Navbar({ initialUser }: NavbarProps) {
    const { user } = useAuthStore();
    const { toggleSidebar } = useUIStore();

    const active = user || initialUser;

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/80">
            {/* Left side - Hamburger + Breadcrumb */}
            <div className="flex items-center gap-4">
                {/* Mobile hamburger */}
                <button
                    onClick={toggleSidebar}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                    aria-label="Toggle Sidebar"
                >
                    <span className="text-xl">☰</span>
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Módulo de Operaciones
                </h2>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-4">
                <DashboardNotifications initialUser={active ?? null} />

                {/* Quick search */}
                <div className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 md:flex dark:border-gray-600 dark:bg-gray-800">
                    <span>🔍</span>
                    <span>Buscar...</span>
                    <kbd className="ml-2 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700">
                        ⌘K
                    </kbd>
                </div>

                {/* Date/Time */}
                <div className="hidden text-sm text-gray-500 lg:block">
                    {new Date().toLocaleDateString('es-VE', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'America/Caracas',
                    })}
                </div>
            </div>
        </header>
    );
}
