'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
    closeInventoryCycleAction,
    getInventoryCyclesAction,
    startInventoryCycleAction,
} from '@/app/actions/inventory-cycle.actions';

type Cycle = {
    id: string;
    label: string;
    periodType: string;
    periodStart: string;
    periodEnd: string | null;
    closedAt: string | null;
    snapshotCount: number;
    notes: string | null;
    createdBy: { firstName: string; lastName: string };
    closedBy: { firstName: string; lastName: string } | null;
};

export default function InventoryCyclesView() {
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [openCycle, setOpenCycle] = useState<Cycle | null>(null);
    const [loading, setLoading] = useState(true);
    const [label, setLabel] = useState('');
    const [periodType, setPeriodType] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM'>('WEEKLY');
    const [notesStart, setNotesStart] = useState('');
    const [notesClose, setNotesClose] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getInventoryCyclesAction();
            if (res.success && res.data) {
                setCycles(res.data.cycles as unknown as Cycle[]);
                setOpenCycle(res.data.openCycle as unknown as Cycle | null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleStart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) {
            alert('Indica un nombre para el ciclo (ej. Semana 10–16 mar 2026)');
            return;
        }
        setBusy(true);
        try {
            const res = await startInventoryCycleAction({
                label: label.trim(),
                periodType,
                notes: notesStart.trim() || undefined,
            });
            if (res.success) {
                setLabel('');
                setNotesStart('');
                await load();
            } else alert(res.message);
        } finally {
            setBusy(false);
        }
    };

    const handleClose = async (id: string) => {
        if (
            !confirm(
                '¿Cerrar este ciclo? Se guardará un snapshot del stock actual por ítem y almacén. Los movimientos históricos no se borran.'
            )
        )
            return;
        setBusy(true);
        try {
            const res = await closeInventoryCycleAction(id, notesClose.trim() || undefined);
            if (res.success) {
                setNotesClose('');
                await load();
                alert(res.message);
            } else alert(res.message);
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 text-center text-gray-500 dark:text-gray-400">Cargando ciclos…</div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ciclos de inventario</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    Un <strong>ciclo</strong> agrupa un periodo (semanal, quincenal o mensual). Al{' '}
                    <strong>cerrar</strong> el ciclo, el sistema guarda una foto del stock en cada almacén (ítem ×
                    área). Ventas, transferencias, auditorías y movimientos siguen en el historial; puedes
                    consultarlos por fecha en los reportes habituales.
                </p>
            </div>

            {!openCycle && (
                <form
                    onSubmit={handleStart}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                >
                    <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                        Iniciar nuevo ciclo
                    </h2>
                    <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/80">
                        Solo puede haber un ciclo abierto a la vez.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold uppercase text-gray-500">Nombre del ciclo</label>
                            <input
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="Ej: Semana 10–16 marzo 2026"
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Tipo de periodo</label>
                            <select
                                value={periodType}
                                onChange={e => setPeriodType(e.target.value as any)}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            >
                                <option value="WEEKLY">Semanal</option>
                                <option value="BIWEEKLY">Quincenal</option>
                                <option value="MONTHLY">Mensual</option>
                                <option value="CUSTOM">Personalizado</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold uppercase text-gray-500">Notas (opcional)</label>
                            <input
                                value={notesStart}
                                onChange={e => setNotesStart(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                        {busy ? 'Guardando…' : 'Abrir ciclo'}
                    </button>
                </form>
            )}

            {openCycle && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-6 dark:border-amber-700 dark:bg-amber-950/30">
                    <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100">Ciclo abierto</h2>
                    <p className="mt-2 font-semibold text-gray-900 dark:text-white">{openCycle.label}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Tipo: {openCycle.periodType} · Inicio:{' '}
                        {new Date(openCycle.periodStart).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
                    </p>
                    <div className="mt-4">
                        <label className="text-xs font-bold uppercase text-gray-500">Notas al cerrar (opcional)</label>
                        <input
                            value={notesClose}
                            onChange={e => setNotesClose(e.target.value)}
                            placeholder="Ej: Corte domingo noche"
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleClose(openCycle.id)}
                        className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow disabled:opacity-50"
                    >
                        Cerrar ciclo y guardar snapshot
                    </button>
                </div>
            )}

            <div>
                <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Historial de ciclos</h2>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                                <th className="px-4 py-3">Nombre</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Cierre</th>
                                <th className="px-4 py-3">Filas snapshot</th>
                                <th className="px-4 py-3 w-32"> </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {cycles.map(c => (
                                <tr key={c.id} className="bg-white dark:bg-gray-900/40">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.label}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.periodType}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                        {c.closedAt
                                            ? new Date(c.closedAt).toLocaleString('es-VE', {
                                                  timeZone: 'America/Caracas',
                                              })
                                            : '— abierto —'}
                                    </td>
                                    <td className="px-4 py-3">{c.snapshotCount}</td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/dashboard/inventario/ciclos/${c.id}`}
                                            className="text-sm font-bold text-teal-600 hover:underline dark:text-teal-400"
                                        >
                                            {c.closedAt && c.snapshotCount > 0 ? 'Ver snapshot' : 'Ver detalle'}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {cycles.length === 0 && (
                        <p className="py-8 text-center text-sm text-gray-400">Aún no hay ciclos registrados</p>
                    )}
                </div>
            </div>
        </div>
    );
}
