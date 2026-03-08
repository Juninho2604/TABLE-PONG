'use client';

import { useState } from 'react';
import { createAreaAction, toggleAreaStatusAction } from '@/app/actions/area.actions';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

interface Area {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
}

export default function AlmacenesView({ initialAreas }: { initialAreas: Area[] }) {
    const { user } = useAuthStore();
    const canManage = hasPermission(user?.role, PERMISSIONS.MANAGE_USERS);

    const [areas, setAreas] = useState(initialAreas);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Almacenes</h1>
                    <p className="text-gray-500">OFICINA, BARRA, DEPOSITO BARRA, DEPOSITO STORE y más.</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                        {showForm ? 'Cancelar' : '+ Nuevo Almacén'}
                    </button>
                )}
            </div>

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
