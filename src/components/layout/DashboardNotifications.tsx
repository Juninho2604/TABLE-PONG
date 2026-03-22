'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listActiveBroadcastsAction } from '@/app/actions/announcements.actions';
import {
    isCaracasSunday,
    SUNDAY_INVENTORY_GUIDE,
    SUNDAY_INVENTORY_ROLES,
    sundayDismissStorageKey,
} from '@/lib/sunday-inventory';

type UserLite = {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
};

type BroadcastRow = {
    id: string;
    title: string;
    body: string;
    kind: string;
    createdAt: string;
    createdBy: { firstName: string; lastName: string; email: string };
};

interface Props {
    initialUser: UserLite | null;
}

export function DashboardNotifications({ initialUser }: Props) {
    const [open, setOpen] = useState(false);
    const [sundayModal, setSundayModal] = useState(false);
    const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [sundayDismissedToday, setSundayDismissedToday] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!initialUser?.id) return;
        const key = sundayDismissStorageKey(initialUser.id);
        if (localStorage.getItem(key)) setSundayDismissedToday(true);
    }, [initialUser?.id]);

    const showSundayBadge = useMemo(() => {
        if (!mounted || !initialUser?.id) return false;
        if (!SUNDAY_INVENTORY_ROLES.has(initialUser.role)) return false;
        if (!isCaracasSunday()) return false;
        return !sundayDismissedToday;
    }, [mounted, initialUser?.id, initialUser?.role, sundayDismissedToday]);

    const loadBroadcasts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listActiveBroadcastsAction();
            if (res.success && res.data) setBroadcasts(res.data as unknown as BroadcastRow[]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBroadcasts();
    }, [loadBroadcasts]);

    useEffect(() => {
        if (showSundayBadge) {
            const t = setTimeout(() => setSundayModal(true), 400);
            return () => clearTimeout(t);
        }
    }, [showSundayBadge]);

    const dismissSundayForToday = () => {
        if (!initialUser?.id) return;
        localStorage.setItem(sundayDismissStorageKey(initialUser.id), '1');
        setSundayDismissedToday(true);
        setSundayModal(false);
    };

    const badgeCount = (showSundayBadge ? 1 : 0) + broadcasts.length;

    return (
        <>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label="Notificaciones"
                >
                    <span className="text-xl">🔔</span>
                    {badgeCount > 0 && (
                        <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
                            {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                    )}
                </button>

                {open && (
                    <>
                        <button
                            type="button"
                            className="fixed inset-0 z-[45] cursor-default bg-transparent"
                            aria-hidden
                            onClick={() => setOpen(false)}
                        />
                        <div className="absolute right-0 top-full z-[50] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-600 dark:bg-gray-900">
                            <div className="border-b border-gray-100 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-4 py-3 dark:border-gray-700">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Notificaciones</p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Comunicados y recordatorios</p>
                            </div>
                            <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
                                {isCaracasSunday() && SUNDAY_INVENTORY_ROLES.has(initialUser?.role || '') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSundayModal(true);
                                            setOpen(false);
                                        }}
                                        className="flex w-full gap-3 border-b border-amber-100/80 bg-amber-50/90 px-4 py-3 text-left transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:hover:bg-amber-900/50"
                                    >
                                        <span className="text-2xl">📋</span>
                                        <div>
                                            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                                                Inventario general (domingo)
                                            </p>
                                            <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">
                                                Ver flujo recomendado para hoy
                                            </p>
                                        </div>
                                    </button>
                                )}

                                {loading && (
                                    <p className="px-4 py-6 text-center text-xs text-gray-400">Cargando…</p>
                                )}

                                {!loading && broadcasts.length === 0 && !isCaracasSunday() && (
                                    <p className="px-4 py-6 text-center text-xs text-gray-400">
                                        No hay mensajes activos
                                    </p>
                                )}

                                {broadcasts.map(b => (
                                    <div
                                        key={b.id}
                                        className="border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-800"
                                    >
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{b.title}</p>
                                        <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">
                                            {b.body}
                                        </p>
                                        <p className="mt-2 text-[10px] text-gray-400">
                                            {b.createdBy.firstName} ·{' '}
                                            {new Date(b.createdAt).toLocaleString('es-VE', {
                                                timeZone: 'America/Caracas',
                                            })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal guía dominical */}
            {sundayModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-amber-200/50 bg-gradient-to-b from-white to-amber-50/80 shadow-2xl dark:border-amber-800/40 dark:from-gray-900 dark:to-amber-950/30">
                        <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
                            <p className="text-xs font-bold uppercase tracking-widest opacity-90">Domingo</p>
                            <h2 className="text-xl font-black leading-tight">{SUNDAY_INVENTORY_GUIDE.title}</h2>
                            <p className="mt-1 text-sm opacity-95">{SUNDAY_INVENTORY_GUIDE.subtitle}</p>
                        </div>
                        <div className="space-y-4 px-6 py-5">
                            {SUNDAY_INVENTORY_GUIDE.steps.map(s => (
                                <div
                                    key={s.n}
                                    className="flex gap-3 rounded-2xl border border-amber-100 bg-white/80 p-4 dark:border-amber-900/30 dark:bg-gray-800/60"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-black text-white">
                                        {s.n}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{s.title}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                            {s.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <p className="rounded-xl bg-amber-100/50 px-3 py-2 text-[11px] text-amber-950 dark:bg-amber-900/20 dark:text-amber-100">
                                Tras leer y aceptar, este aviso no volverá a mostrarse automáticamente hoy. Puedes
                                reabrirlo desde 🔔 Notificaciones cuando quieras.
                            </p>
                        </div>
                        <div className="sticky bottom-0 flex gap-3 border-t border-amber-100 bg-white/90 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/95">
                            <button
                                type="button"
                                onClick={() => setSundayModal(false)}
                                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    dismissSundayForToday();
                                }}
                                className="flex-[2] rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/25"
                            >
                                Entendido — no mostrar más hoy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
