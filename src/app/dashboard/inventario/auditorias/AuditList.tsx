'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { deleteAuditAction } from '@/app/actions/audit.actions';

interface Audit {
    id: string;
    name: string | null;
    status: string;
    createdAt: Date;
    createdById: string;
    createdBy: { firstName: string | null; lastName: string | null };
    resolvedAt: Date | null;
    resolvedBy: { firstName: string | null; lastName: string | null } | null;
    areaId?: string | null;
    _count: { items: number };
}

export function AuditList({ initialAudits }: { initialAudits: Audit[] }) {
    const [audits, setAudits] = useState(initialAudits);
    const [statusFilter, setStatusFilter] = useState<string>('TODOS');

    const filteredAudits = useMemo(() => {
        if (statusFilter === 'TODOS') return audits;
        return audits.filter(a => a.status === statusFilter);
    }, [audits, statusFilter]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar esta auditoría?')) return;
        
        const res = await deleteAuditAction(id);
        if (res.success) {
            toast.success('Auditoría eliminada');
            setAudits(audits.filter(a => a.id !== id));
        } else {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <div className="flex flex-wrap gap-2">
                {['TODOS', 'DRAFT', 'APPROVED', 'REJECTED', 'VOIDED'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={cn(
                            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                            statusFilter === status 
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" 
                                : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                        )}
                    >
                        {status === 'TODOS' && 'Todos'}
                        {status === 'DRAFT' && 'Borradores'}
                        {status === 'APPROVED' && 'Aprobados'}
                        {status === 'REJECTED' && 'Rechazados'}
                        {status === 'VOIDED' && 'Anulados'}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Fecha</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Nombre / Ref</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Creado Por</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Items Asignados</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredAudits.map((audit) => (
                                <tr key={audit.id} className="group hover:bg-gray-50/80 transition-colors dark:hover:bg-gray-700/30">
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {format(new Date(audit.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link href={`/dashboard/inventario/auditorias/${audit.id}`} className="font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400">
                                            {audit.name || 'Sin nombre'}
                                        </Link>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-gray-500 font-mono">{audit.id.substring(0, 8)}...</p>
                                            {audit.areaId ? (
                                                <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded dark:bg-blue-900/30 dark:text-blue-400">
                                                    Área Específica
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-400">
                                                    Global
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                            audit.status === 'DRAFT' && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                                            audit.status === 'APPROVED' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
                                            audit.status === 'REJECTED' && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                                            audit.status === 'VOIDED' && "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                        )}>
                                            {audit.status === 'DRAFT' && '📝 Borrador'}
                                            {audit.status === 'APPROVED' && '✅ Aprobado'}
                                            {audit.status === 'REJECTED' && '❌ Rechazado'}
                                            {audit.status === 'VOIDED' && '🚫 Anulado'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {audit.createdBy.firstName} {audit.createdBy.lastName}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {audit._count.items}
                                            </span>
                                            {audit.status === 'DRAFT' && (
                                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    Requiere Conteo
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Link
                                                href={`/dashboard/inventario/auditorias/${audit.id}`}
                                                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                                                title="Ver Detalles"
                                            >
                                                👁️
                                            </Link>
                                            {audit.status === 'DRAFT' && (
                                                <button
                                                    onClick={(e) => handleDelete(audit.id, e)}
                                                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                                    title="Eliminar Borrador"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredAudits.length === 0 && (
                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                        <p className="text-4xl mb-3">📁</p>
                        <p className="text-base font-medium">No se encontraron auditorías</p>
                        <p className="text-sm mt-1">Con el estado "{statusFilter}"</p>
                    </div>
                )}
            </div>
        </div>
    );
}
