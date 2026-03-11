'use client';

import { useState } from 'react';
import {
    createAreaAction,
    toggleAreaStatusAction,
    mergeAreasAction,
    analyzeAreasAction,
} from '@/app/actions/area.actions';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface Area {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
}

interface AreaWithStats {
    id: string;
    name: string;
    isActive: boolean;
    itemsWithStock: number;
    totalStock: number;
}

export default function AlmacenesView({ initialAreas }: { initialAreas: Area[] }) {
    const { user } = useAuthStore();
    const canManage = hasPermission(user?.role, PERMISSIONS.MANAGE_USERS);

    const [areas, setAreas] = useState(initialAreas);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Análisis de duplicados
    const [analysis, setAnalysis] = useState<{
        areas: AreaWithStats[];
        duplicates: AreaWithStats[][];
        empty: AreaWithStats[];
    } | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [mergeSource, setMergeSource] = useState('');
    const [mergeTarget, setMergeTarget] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            const res = await createAreaAction(name, description);
            if (res.success) {
                toast.success(res.message);
                setShowForm(false);
                setName('');
                setDescription('');
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error('Error al crear');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id: string, current: boolean) => {
        if (!confirm(`¿${current ? 'Desactivar' : 'Activar'} este almacén?`)) return;
        setIsLoading(true);
        try {
            const res = await toggleAreaStatusAction(id, !current);
            if (res.success) {
                toast.success(res.message);
                setAreas(areas.map(a => (a.id === id ? { ...a, isActive: !current } : a)));
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error('Error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyze = async () => {
        setIsLoading(true);
        try {
            const result = await analyzeAreasAction();
            setAnalysis(result);
            setShowAnalysis(true);
        } catch {
            toast.error('Error al analizar almacenes');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!mergeSource || !mergeTarget) {
            toast.error('Selecciona los almacenes a fusionar');
            return;
        }
        if (mergeSource === mergeTarget) {
            toast.error('El origen y destino no pueden ser iguales');
            return;
        }

        const sourceArea = analysis?.areas.find(a => a.id === mergeSource);
        const targetArea = analysis?.areas.find(a => a.id === mergeTarget);

        if (!confirm(`¿Fusionar "${sourceArea?.name}" → "${targetArea?.name}"?\n\nEl stock de "${sourceArea?.name}" pasará a "${targetArea?.name}" y el primero quedará desactivado.\n\nEsta acción NO borra datos.`)) return;

        setIsLoading(true);
        try {
            const res = await mergeAreasAction(mergeSource, mergeTarget);
            if (res.success) {
                toast.success(res.message);
                setMergeSource('');
                setMergeTarget('');
                // Refrescar
                const newAnalysis = await analyzeAreasAction();
                setAnalysis(newAnalysis);
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error('Error al fusionar');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeactivateEmpty = async (id: string, areaName: string) => {
        if (!confirm(`¿Desactivar "${areaName}"?\n\nEste almacén no tiene productos con stock. Se desactivará sin borrar ningún dato.`)) return;
        setIsLoading(true);
        try {
            const res = await toggleAreaStatusAction(id, false);
            if (res.success) {
                toast.success(`"${areaName}" desactivado`);
                const newAnalysis = await analyzeAreasAction();
                setAnalysis(newAnalysis);
                setAreas(areas.map(a => (a.id === id ? { ...a, isActive: false } : a)));
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error('Error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Almacenes</h1>
                    <p className="text-gray-500">OFICINA, BARRA, DEPOSITO BARRA, DEPOSITO STORE y más.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {canManage && (
                        <>
                            <button
                                onClick={handleAnalyze}
                                disabled={isLoading}
                                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 disabled:opacity-50"
                            >
                                🔍 Analizar Duplicados
                            </button>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                            >
                                {showForm ? 'Cancelar' : '+ Nuevo Almacén'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Panel de Análisis y Limpieza */}
            {showAnalysis && analysis && canManage && (
                <div className="rounded-xl border border-yellow-400/40 bg-yellow-950/30 p-6 space-y-5">
                    <h2 className="text-lg font-bold text-yellow-300">🔍 Análisis de Almacenes</h2>

                    {/* Almacenes vacíos */}
                    {analysis.empty.filter(a => a.isActive).length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">
                                Almacenes activos sin stock ({analysis.empty.filter(a => a.isActive).length})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {analysis.empty.filter(a => a.isActive).map(a => (
                                    <div key={a.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-600">
                                        <span className="text-white text-sm font-medium">{a.name}</span>
                                        <span className="text-gray-500 text-xs">0 ítems</span>
                                        <button
                                            onClick={() => handleDeactivateEmpty(a.id, a.name)}
                                            disabled={isLoading}
                                            className="ml-1 text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
                                        >
                                            Desactivar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Duplicados detectados */}
                    {analysis.duplicates.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">
                                Grupos duplicados detectados
                            </h3>
                            <div className="space-y-2">
                                {analysis.duplicates.map((group, i) => (
                                    <div key={i} className="bg-gray-800 rounded-lg p-3 border border-orange-500/30">
                                        <p className="text-orange-300 text-xs font-semibold mb-1">Almacenes con nombre similar:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {group.map(a => (
                                                <span key={a.id} className="text-white text-sm bg-gray-700 px-2 py-1 rounded">
                                                    {a.name}
                                                    <span className="text-gray-400 text-xs ml-1">({a.itemsWithStock} ítems c/stock)</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Fusionar dos almacenes */}
                    <div className="border-t border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Fusionar almacenes</h3>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">ORIGEN (se desactivará)</label>
                                <select
                                    value={mergeSource}
                                    onChange={e => setMergeSource(e.target.value)}
                                    className="rounded-lg border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {analysis.areas.filter(a => a.isActive).map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({a.itemsWithStock} ítems c/stock)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-gray-400 text-lg pb-1">→</div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">DESTINO (recibe el stock)</label>
                                <select
                                    value={mergeTarget}
                                    onChange={e => setMergeTarget(e.target.value)}
                                    className="rounded-lg border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {analysis.areas.filter(a => a.isActive && a.id !== mergeSource).map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({a.itemsWithStock} ítems c/stock)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleMerge}
                                disabled={isLoading || !mergeSource || !mergeTarget}
                                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                            >
                                {isLoading ? 'Fusionando...' : 'Fusionar'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            El stock del ORIGEN se suma al DESTINO. No se borra ningún dato, solo se desactiva el almacén origen.
                        </p>
                    </div>

                    {/* Tabla de todos los almacenes con stock */}
                    <div className="border-t border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Estado actual de todos los almacenes</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs uppercase">
                                    <th className="text-left pb-1">Nombre</th>
                                    <th className="text-center pb-1">Estado</th>
                                    <th className="text-right pb-1">Ítems c/stock</th>
                                    <th className="text-right pb-1">Stock total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.areas.map(a => (
                                    <tr key={a.id} className="border-t border-gray-800">
                                        <td className="py-1 text-white">{a.name}</td>
                                        <td className="py-1 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${a.isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                {a.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="py-1 text-right text-gray-300">{a.itemsWithStock}</td>
                                        <td className="py-1 text-right text-gray-300">{a.totalStock.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showForm && canManage && (
                <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 font-semibold">Crear almacén</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ej: DEPOSITO STORE"
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Opcional"
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button type="submit" disabled={isLoading} className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50">
                            {isLoading ? 'Creando...' : 'Crear'}
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Descripción</th>
                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500">Estado</th>
                            {canManage && <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {areas.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No hay almacenes. Ejecuta el seed o crea uno nuevo.
                                </td>
                            </tr>
                        ) : (
                            areas.map(a => (
                                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-6 py-4 font-medium">{a.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{a.description || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${a.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {a.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleToggle(a.id, a.isActive)}
                                                disabled={isLoading}
                                                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                                            >
                                                {a.isActive ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
