'use client';

import { useState } from 'react';
import {
    createBroadcastAction,
    listAllBroadcastsAdminAction,
    toggleBroadcastActiveAction,
} from '@/app/actions/announcements.actions';

type Row = {
    id: string;
    title: string;
    body: string;
    kind: string;
    isActive: boolean;
    createdAt: string;
    createdBy: { firstName: string; lastName: string; email: string };
};

export default function AnnouncementsAdmin({ initial }: { initial: Row[] }) {
    const [rows, setRows] = useState(initial);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await createBroadcastAction({ title, body });
            if (res.success) {
                setTitle('');
                setBody('');
                const list = await listAllBroadcastsAdminAction();
                if (list.success && list.data) setRows(list.data as unknown as Row[]);
            } else alert(res.message);
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (id: string, isActive: boolean) => {
        const res = await toggleBroadcastActiveAction(id, !isActive);
        if (res.success) {
            setRows(prev => prev.map(r => (r.id === id ? { ...r, isActive: !isActive } : r)));
        } else alert(res.message);
    };

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Anuncios a gerencia</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Los mensajes activos aparecen en 🔔 (esquina superior derecha) para todos los usuarios del
                    dashboard.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
                <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Nuevo comunicado</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500">Título</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500">Mensaje</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={5}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                        {saving ? 'Publicando…' : 'Publicar'}
                    </button>
                </div>
            </form>

            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <h2 className="border-b border-gray-100 px-6 py-4 text-lg font-bold dark:border-gray-700">
                    Historial
                </h2>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map(r => (
                        <li key={r.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">{r.title}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                                    {r.body}
                                </p>
                                <p className="mt-2 text-[11px] text-gray-400">
                                    {r.createdBy.firstName} {r.createdBy.lastName} ·{' '}
                                    {new Date(r.createdAt).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggle(r.id, r.isActive)}
                                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${
                                    r.isActive
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                }`}
                            >
                                {r.isActive ? 'Desactivar' : 'Reactivar'}
                            </button>
                        </li>
                    ))}
                    {rows.length === 0 && (
                        <li className="px-6 py-8 text-center text-sm text-gray-400">Sin mensajes aún</li>
                    )}
                </ul>
            </div>
        </div>
    );
}
