'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import {
    getMesoneroTopItemsAction,
    getMesoneroMenuAvailabilityAction,
} from '@/app/actions/mesonero.actions';

interface TopItem {
    name: string;
    totalQty: number;
}

interface MenuCategoryAvailability {
    category: string;
    items: { name: string; available: boolean }[];
}

export default function MesonerosDashboardPage() {
    const { user } = useAuthStore();
    const [topItems, setTopItems] = useState<TopItem[]>([]);
    const [menuCategories, setMenuCategories] = useState<MenuCategoryAvailability[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            const [topResult, menuResult] = await Promise.all([
                getMesoneroTopItemsAction(),
                getMesoneroMenuAvailabilityAction(),
            ]);
            if (topResult.success && topResult.data) setTopItems(topResult.data);
            if (menuResult.success && menuResult.data) setMenuCategories(menuResult.data);
            setIsLoading(false);
        }
        load();
    }, []);

    const maxQty = topItems[0]?.totalQty || 1;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Bienvenida */}
            <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white shadow-lg">
                <h1 className="text-2xl font-black tracking-tight">
                    ¡Bienvenido, {user?.firstName}!
                </h1>
                <p className="mt-1 text-orange-100 text-sm">
                    Turno activo · Table Pong Santa Paula
                </p>
                <Link
                    href="/dashboard/pos/mesero"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 transition px-4 py-2 text-sm font-bold"
                >
                    🧑‍🍳 Ir al POS Mesero
                </Link>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500">Cargando información...</div>
            ) : (
                <>
                    {/* Top productos últimos 30 días */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-4">
                            Productos más pedidos · últimos 30 días
                        </h2>
                        {topItems.length === 0 ? (
                            <p className="text-sm text-gray-400">Sin datos todavía</p>
                        ) : (
                            <div className="space-y-3">
                                {topItems.map((item, i) => (
                                    <div key={item.name} className="flex items-center gap-3">
                                        <span className="w-5 text-xs font-black text-gray-400 text-right">{i + 1}</span>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-bold">{item.name}</span>
                                                <span className="text-xs text-gray-500 font-medium">{item.totalQty} uds</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400"
                                                    style={{ width: `${(item.totalQty / maxQty) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Disponibilidad del menú */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-4">
                            Disponibilidad del menú hoy
                        </h2>
                        {menuCategories.length === 0 ? (
                            <p className="text-sm text-gray-400">Sin ítems configurados</p>
                        ) : (
                            <div className="space-y-5">
                                {menuCategories.map(cat => {
                                    const available = cat.items.filter(i => i.available).length;
                                    const total = cat.items.length;
                                    return (
                                        <div key={cat.category}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-gray-400">{cat.category}</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                    available === total
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : available === 0
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                }`}>
                                                    {available}/{total} disponibles
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {cat.items.map(item => (
                                                    <span
                                                        key={item.name}
                                                        className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                                                            item.available
                                                                ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                                                                : 'bg-red-50 text-red-700 border border-red-200 line-through opacity-60 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                        }`}
                                                    >
                                                        {item.available ? '' : '✕ '}{item.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Recordatorios de servicio */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-4">
                            Recordatorios de servicio
                        </h2>
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            <li className="flex items-start gap-2"><span>✓</span> Confirma con cocina los ítems agotados antes del turno</li>
                            <li className="flex items-start gap-2"><span>✓</span> Registra cada mesa en el POS al iniciar la atención</li>
                            <li className="flex items-start gap-2"><span>✓</span> Envía el pedido a cocina tan pronto el cliente confirme</li>
                            <li className="flex items-start gap-2"><span>✓</span> Para anulaciones, comunícate con la caja o gerencia</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
