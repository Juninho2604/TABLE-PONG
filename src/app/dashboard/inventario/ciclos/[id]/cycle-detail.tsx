'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    exportCycleSnapshotCsvAction,
    getCycleSnapshotRowsAction,
    getInventoryAreasForCycleFilterAction,
} from '@/app/actions/inventory-cycle.actions';

type CycleHeader = {
    id: string;
    label: string;
    periodType: string;
    periodStart: Date | string;
    periodEnd: Date | string | null;
    closedAt: Date | string | null;
    snapshotCount: number;
    notes: string | null;
    createdBy: { firstName: string; lastName: string };
    closedBy: { firstName: string; lastName: string } | null;
};

type Row = {
    id: string;
    quantityOnClose: number;
    unit: string;
    unitCostSnapshot: number | null;
    inventoryItem: { name: string; sku: string; baseUnit: string };
    area: { name: string };
};

const PAGE_SIZE = 50;

export default function CycleSnapshotDetail({ cycle }: { cycle: CycleHeader }) {
    const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
    const [areaId, setAreaId] = useState<string>('');
    const [rows, setRows] = useState<Row[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const isClosed = Boolean(cycle.closedAt);

    const load = useCallback(async () => {
        if (!isClosed) {
            setLoading(false);
            setRows([]);
            setTotal(0);
            return;
        }
        setLoading(true);
        try {
            const res = await getCycleSnapshotRowsAction(cycle.id, {
                areaId: areaId || null,
                skip: page * PAGE_SIZE,
                take: PAGE_SIZE,
            });
            if (res.success && res.data) {
                setRows(res.data.rows as unknown as Row[]);
                setTotal(res.data.total);
            } else {
                setRows([]);
                setTotal(0);
            }
        } finally {
            setLoading(false);
        }
    }, [cycle.id, areaId, page, isClosed]);



    useEffect(() => {

        getInventoryAreasForCycleFilterAction().then(r => {

            if (r.success && r.data) setAreas(r.data);

        });

    }, []);



    useEffect(() => {

        load();

    }, [load]);



    useEffect(() => {

        setPage(0);

    }, [areaId]);



    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));



    const handleExport = async () => {

        setExporting(true);

        try {

            const res = await exportCycleSnapshotCsvAction(cycle.id, areaId || null);

            if (res.success && res.data) {

                const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8' });

                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');

                a.href = url;

                a.download = res.data.filename;

                a.click();

                URL.revokeObjectURL(url);

            } else alert((res as { message?: string }).message || 'Error');

        } finally {

            setExporting(false);

        }

    };



    const fmt = useMemo(

        () => (d: Date | string | null) =>

            d

                ? new Date(d).toLocaleString('es-VE', { timeZone: 'America/Caracas' })

                : '—',

        []

    );



    return (

        <div className="mx-auto max-w-6xl space-y-6">

            <div className="flex flex-wrap items-center gap-3 text-sm">

                <Link

                    href="/dashboard/inventario/ciclos"

                    className="text-teal-600 hover:underline dark:text-teal-400"

                >

                    ← Ciclos de inventario

                </Link>

            </div>



            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{cycle.label}</h1>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">

                    <div>

                        <dt className="text-gray-500">Tipo de periodo</dt>

                        <dd className="font-medium text-gray-900 dark:text-white">{cycle.periodType}</dd>

                    </div>

                    <div>

                        <dt className="text-gray-500">Inicio</dt>

                        <dd className="font-medium text-gray-900 dark:text-white">{fmt(cycle.periodStart)}</dd>

                    </div>

                    <div>

                        <dt className="text-gray-500">Cierre</dt>

                        <dd className="font-medium text-gray-900 dark:text-white">{fmt(cycle.closedAt)}</dd>

                    </div>

                    <div>

                        <dt className="text-gray-500">Filas en snapshot</dt>

                        <dd className="font-medium text-gray-900 dark:text-white">{cycle.snapshotCount}</dd>

                    </div>

                    <div className="sm:col-span-2">

                        <dt className="text-gray-500">Creado por</dt>

                        <dd className="font-medium text-gray-900 dark:text-white">

                            {cycle.createdBy.firstName} {cycle.createdBy.lastName}

                        </dd>

                    </div>

                    {cycle.closedBy && (

                        <div className="sm:col-span-2">

                            <dt className="text-gray-500">Cerrado por</dt>

                            <dd className="font-medium text-gray-900 dark:text-white">

                                {cycle.closedBy.firstName} {cycle.closedBy.lastName}

                            </dd>

                        </div>

                    )}

                    {cycle.notes && (

                        <div className="sm:col-span-2">

                            <dt className="text-gray-500">Notas</dt>

                            <dd className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{cycle.notes}</dd>

                        </div>

                    )}

                </dl>

            </div>



            {!isClosed && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    Este ciclo está <strong>abierto</strong>: aún no hay snapshot. Al cerrarlo el sistema
                    guardará el stock por almacén.
                </div>
            )}

            {isClosed && (

                <div className="space-y-4">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                        <div>

                            <label className="text-xs font-bold uppercase text-gray-500">Filtrar por almacén</label>

                            <select

                                value={areaId}

                                onChange={e => setAreaId(e.target.value)}

                                className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"

                            >

                                <option value="">Todos los almacenes</option>

                                {areas.map(a => (

                                    <option key={a.id} value={a.id}>

                                        {a.name}

                                    </option>

                                ))}

                            </select>

                        </div>

                        <button

                            type="button"

                            onClick={handleExport}

                            disabled={exporting || total === 0}

                            className="rounded-xl border border-teal-600 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-100 disabled:opacity-40 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-900/50"

                        >

                            {exporting ? 'Generando…' : '📥 Descargar CSV (Excel)'}

                        </button>

                    </div>



                    <p className="text-xs text-gray-500 dark:text-gray-400">

                        Mostrando {rows.length} de {total} filas · separador CSV compatible con Excel (UTF-8)

                    </p>



                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">

                        <table className="w-full text-left text-sm">

                            <thead className="bg-gray-100 dark:bg-gray-800">

                                <tr>

                                    <th className="px-3 py-2">Almacén</th>

                                    <th className="px-3 py-2">SKU</th>

                                    <th className="px-3 py-2">Producto</th>

                                    <th className="px-3 py-2 text-right">Cantidad cierre</th>

                                    <th className="px-3 py-2">Unidad</th>

                                    <th className="px-3 py-2 text-right">Costo u.</th>

                                </tr>

                            </thead>

                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">

                                {loading

                                    ? Array.from({ length: 6 }).map((_, i) => (

                                          <tr key={i}>

                                              <td colSpan={6} className="px-3 py-2">

                                                  <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />

                                              </td>

                                          </tr>

                                      ))

                                    : rows.map(r => (

                                          <tr key={r.id} className="bg-white dark:bg-gray-900/40">

                                              <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{r.area.name}</td>

                                              <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">

                                                  {r.inventoryItem.sku}

                                              </td>

                                              <td className="px-3 py-2 text-gray-900 dark:text-white">{r.inventoryItem.name}</td>

                                              <td className="px-3 py-2 text-right font-mono">

                                                  {r.quantityOnClose.toLocaleString('es-VE', {

                                                      maximumFractionDigits: 4,

                                                  })}

                                              </td>

                                              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.unit}</td>

                                              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">

                                                  {r.unitCostSnapshot != null

                                                      ? r.unitCostSnapshot.toLocaleString('es-VE', {

                                                            maximumFractionDigits: 4,

                                                        })

                                                      : '—'}

                                              </td>

                                          </tr>

                                      ))}

                            </tbody>

                        </table>

                        {!loading && rows.length === 0 && (

                            <p className="py-8 text-center text-sm text-gray-400">Sin filas en este filtro</p>

                        )}

                    </div>



                    {totalPages > 1 && (

                        <div className="flex items-center justify-between gap-2">

                            <button

                                type="button"

                                disabled={page <= 0}

                                onClick={() => setPage(p => Math.max(0, p - 1))}

                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold disabled:opacity-40 dark:border-gray-600"

                            >

                                Anterior

                            </button>

                            <span className="text-sm text-gray-600 dark:text-gray-400">

                                Página {page + 1} / {totalPages}

                            </span>

                            <button

                                type="button"

                                disabled={page >= totalPages - 1}

                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}

                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold disabled:opacity-40 dark:border-gray-600"

                            >

                                Siguiente

                            </button>

                        </div>

                    )}

                </div>

            )}

        </div>

    );

}

