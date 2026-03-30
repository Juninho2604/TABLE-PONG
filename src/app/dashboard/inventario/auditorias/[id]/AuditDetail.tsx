'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { saveDraftCountsAction, approveAuditAction, voidAuditAction } from '@/app/actions/audit.actions';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface AuditItem {
    id: string;
    inventoryItem: { name: string; sku: string; baseUnit: string; category?: string };
    systemStock: number;
    countedStock: number;
    difference: number;
    costSnapshot: number | null;
    notes: string | null;
}

interface Audit {
    id: string;
    name: string | null;
    status: string;
    createdAt: Date;
    createdBy: { firstName: string | null; lastName: string | null };
    resolvedAt: Date | null;
    resolvedBy: { firstName: string | null; lastName: string | null } | null;
    items: AuditItem[];
    notes?: string | null;
}

export function AuditDetail({ audit }: { audit: Audit }) {
    const router = useRouter();
    const { user } = useAuthStore();
    const userId = user?.id || 'unknown';
    const [isApproving, setIsApproving] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Convert items to map for tracking local changes
    const [localCounts, setLocalCounts] = useState<Record<string, number>>(
        audit.items.reduce((acc, item) => {
            acc[item.id] = item.countedStock;
            return acc;
        }, {} as Record<string, number>)
    );
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
    const [showOnlyUncounted, setShowOnlyUncounted] = useState(false);

    // Track un-saved changes
    const unsavedChangesCount = useMemo(() => {
        return audit.items.filter(i => localCounts[i.id] !== i.countedStock).length;
    }, [audit.items, localCounts]);

    // Handle count change
    const handleCountChange = (itemId: string, value: string) => {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed >= 0) {
            setLocalCounts(prev => ({ ...prev, [itemId]: parsed }));
        } else if (value === '') {
            setLocalCounts(prev => ({ ...prev, [itemId]: 0 }));
        }
    };

    // Calculate metrics
    const metrics = useMemo(() => {
        let totalItems = audit.items.length;
        let itemsWithDiff = 0;
        let itemsUncounted = 0;
        let totalValueDiff = 0;

        audit.items.forEach(item => {
            const currentCount = localCounts[item.id];
            const diff = currentCount - item.systemStock;
            
            if (diff !== 0) itemsWithDiff++;
            if (currentCount === 0 && audit.status === 'DRAFT') itemsUncounted++;
            
            totalValueDiff += diff * (item.costSnapshot || 0);
        });

        return { totalItems, itemsWithDiff, itemsUncounted, totalValueDiff };
    }, [audit.items, localCounts, audit.status]);

    // Filter and group items
    const filteredAndGroupedItems = useMemo(() => {
        return audit.items.filter(item => {
            const currentCount = localCounts[item.id];
            const diff = currentCount - item.systemStock;
            
            // Search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!item.inventoryItem.name.toLowerCase().includes(term) && !item.inventoryItem.sku.toLowerCase().includes(term)) {
                    return false;
                }
            }
            
            // Toggles
            if (showOnlyDiffs && diff === 0) return false;
            if (showOnlyUncounted && currentCount !== 0) return false;
            
            return true;
        }).reduce((acc, item) => {
            const cat = item.inventoryItem.category || 'Sin Categoría';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {} as Record<string, AuditItem[]>);
    }, [audit.items, localCounts, searchTerm, showOnlyDiffs, showOnlyUncounted]);

    // Actions
    const handleSaveBatch = async () => {
        if (unsavedChangesCount === 0) return;
        setIsSaving(true);
        
        const counts = audit.items
            .filter(i => localCounts[i.id] !== i.countedStock)
            .map(i => ({
                itemId: i.id,
                countedStock: localCounts[i.id],
            }));
            
        const res = await saveDraftCountsAction({ auditId: audit.id, counts });
        if (res.success) {
            toast.success(res.message);
            router.refresh(); // Refresh data to get sync with local count
        } else {
            toast.error(res.message);
        }
        setIsSaving(false);
    };

    const handleApprove = async () => {
        if (unsavedChangesCount > 0) {
            toast.error('Tienes cambios sin guardar. Guárdalos antes de aprobar.');
            return;
        }
        if (metrics.itemsUncounted > 0) {
            if (!confirm(`Hay ${metrics.itemsUncounted} items marcados en 0. ¿Estás seguro de continuar?`)) return;
        } else {
            if (!confirm('¿Estás seguro de aprobar esta auditoría? Esto actualizará el inventario REAL.')) return;
        }

        setIsApproving(true);
        const res = await approveAuditAction({ auditId: audit.id });
        setIsApproving(false);

        if (res.success) {
            toast.success('Auditoría Aprobada Exitosamente');
            router.refresh();
        } else {
            toast.error(res.message);
        }
    };

    const handleVoid = async () => {
        if (!confirm('⚠️ ¿Estás seguro de ANULAR esta auditoría?\n\nEsto revertirá todos los movimientos de stock generados.\nEsta acción no se puede deshacer.')) return;

        const res = await voidAuditAction(audit.id);
        if (res.success) {
            toast.success('Auditoría anulada correctamente');
            router.refresh();
        } else {
            toast.error(res.message);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 relative pb-20">
            {/* Header / Actions - Hidden on Print */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 print:hidden sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {audit.name || 'Auditoría sin nombre'}
                        </h1>
                        <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            audit.status === 'DRAFT' ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                                audit.status === 'APPROVED' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                    audit.status === 'VOIDED' ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" :
                                        "bg-red-100 text-red-800"
                        )}>
                            {audit.status}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        Creada por {audit.createdBy.firstName} el {format(new Date(audit.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                    {audit.notes && (
                        <p className="mt-1 text-xs text-gray-400 max-w-md whitespace-pre-wrap">{audit.notes}</p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    >
                        🖨️ Imprimir
                    </button>

                    {audit.status === 'APPROVED' && (
                        <button
                            onClick={handleVoid}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
                        >
                            🚫 Anular Auditoría
                        </button>
                    )}

                    {audit.status === 'DRAFT' && (
                        <button
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {isApproving ? 'Procesando...' : '✅ Aprobar y Ajustar Inventario'}
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Items</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalItems}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/30 dark:bg-amber-900/10">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Mermas / Sobrantes</p>
                    <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-300">{metrics.itemsWithDiff}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/30 dark:bg-blue-900/10">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-400">Sin Contar (Cero)</p>
                    <p className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-300">{metrics.itemsUncounted}</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm dark:border-purple-900/30 dark:bg-purple-900/10">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-400">Variación ($)</p>
                    <p className={cn(
                        "mt-2 text-2xl font-bold",
                        metrics.totalValueDiff > 0 ? "text-emerald-700 dark:text-emerald-400" : 
                        metrics.totalValueDiff < 0 ? "text-red-700 dark:text-red-400" : "text-purple-900 dark:text-purple-300"
                    )}>
                        {metrics.totalValueDiff > 0 ? '+' : ''}{formatCurrency(metrics.totalValueDiff)}
                    </p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-center lg:justify-between print:hidden">
                <div className="relative flex-1 lg:max-w-sm">
                    <input
                        type="text"
                        placeholder="Buscar producto por nombre o SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 pl-10 pr-4 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={showOnlyDiffs}
                            onChange={(e) => setShowOnlyDiffs(e.target.checked)}
                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        Solo con diferencias
                    </label>
                    {audit.status === 'DRAFT' && (
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={showOnlyUncounted}
                                onChange={(e) => setShowOnlyUncounted(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Solo sin contar (Cero)
                        </label>
                    )}
                </div>
            </div>

            {/* Print Header (Visible only on print) */}
            <div className="hidden print:block mb-8">
                <h1 className="text-2xl font-bold">Reporte de Auditoría de Inventario</h1>
                <p className="text-sm">Ref: {audit.id}</p>
                <div className="mt-4 flex justify-between border-b pb-4">
                    <div>
                        <p><strong>Fecha:</strong> {format(new Date(audit.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                        <p><strong>Responsable:</strong> {audit.createdBy.firstName} {audit.createdBy.lastName}</p>
                    </div>
                    <div className="text-right">
                        <p><strong>Estado:</strong> {audit.status}</p>
                        <p><strong>Items Totales:</strong> {audit.items.length}</p>
                    </div>
                </div>
            </div>

            {/* Content Table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800 print:border-0 print:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Item</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-right">Sistema</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-right">Físico</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white text-right">Dif.</th>
                                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white pl-8">Variación Dinero ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {Object.entries(filteredAndGroupedItems).map(([category, items]) => (
                                <React.Fragment key={category}>
                                    <tr className="bg-gray-50/80 dark:bg-gray-800/80">
                                        <td colSpan={5} className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 sticky left-0 uppercase text-xs tracking-wider">
                                            {category} ({items.length})
                                        </td>
                                    </tr>
                                    {items.map((item) => {
                                        const currentCount = localCounts[item.id];
                                        const diff = currentCount - item.systemStock;
                                        const isUncounted = currentCount === 0 && audit.status === 'DRAFT';
                                        
                                        return (
                                            <tr key={item.id} className={cn(
                                                "group transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50",
                                                isUncounted ? "bg-amber-50/40 dark:bg-amber-900/10" :
                                                diff !== 0 ? "bg-gray-50/40 dark:bg-gray-800/40" : ""
                                            )}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 cursor-pointer">
                                                        {isUncounted && <span className="text-amber-500" title="Aún no contado">⚠️</span>}
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-white whitespace-normal max-w-[200px] lg:max-w-xs line-clamp-2">
                                                                {item.inventoryItem.name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">{item.inventoryItem.sku}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500">
                                                    {formatNumber(item.systemStock)} {item.inventoryItem.baseUnit}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {audit.status === 'DRAFT' ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={currentCount.toString()}
                                                            onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                            className={cn(
                                                                "w-24 rounded border px-2 py-1.5 text-right font-medium outline-none transition-colors",
                                                                isUncounted 
                                                                    ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100" 
                                                                    : localCounts[item.id] !== item.countedStock 
                                                                        ? "border-blue-400 bg-blue-50 text-blue-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-100"
                                                                        : "border-gray-200 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                                            )}
                                                            onFocus={(e) => {
                                                                if (e.target.value === '0') e.target.select();
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="font-bold text-gray-900 dark:text-white">
                                                            {formatNumber(item.countedStock)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {diff === 0 ? (
                                                        <span className="text-gray-400 font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">0.00</span>
                                                    ) : (
                                                        <span className={cn(
                                                            "font-bold px-2 py-1 rounded",
                                                            diff > 0 
                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        )}>
                                                            {diff > 0 ? '+' : ''}{formatNumber(diff)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 pl-8 text-left">
                                                    {diff !== 0 ? (
                                                        <span className={cn(
                                                            "font-medium",
                                                            diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                                        )}>
                                                            {formatCurrency(diff * (item.costSnapshot || 0))}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            {Object.keys(filteredAndGroupedItems).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-500">
                                        No se encontraron items con estos filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Signature (Print Only) */}
            <div className="hidden print:flex mt-12 justify-between px-8">
                <div className="border-t border-black px-8 pt-2 text-center">
                    <p>Contado Por</p>
                </div>
                <div className="border-t border-black px-8 pt-2 text-center">
                    <p>Verificado Por</p>
                </div>
                <div className="border-t border-black px-8 pt-2 text-center">
                    <p>Aprobado Por</p>
                </div>
            </div>

            {/* Batch Save Floating Bar */}
            {unsavedChangesCount > 0 && audit.status === 'DRAFT' && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in print:hidden">
                    <div className="flex items-center gap-4 rounded-full bg-gray-900/90 backdrop-blur border border-gray-700 p-2 pl-6 pr-2 shadow-2xl dark:bg-white/90 dark:border-gray-200">
                        <span className="text-sm font-medium text-white dark:text-gray-900">
                            Tienes {unsavedChangesCount} {unsavedChangesCount === 1 ? 'cambio' : 'cambios'} sin guardar.
                        </span>
                        <button
                            onClick={handleSaveBatch}
                            disabled={isSaving}
                            className="rounded-full bg-amber-500 px-6 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Conteos'}
                        </button>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { background: white; color: black; }
                    nav, aside, header { display: none !important; }
                    main { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
        </div>
    );
}
