'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { createAuditDraftAction, getInventoryForAuditAction, type AuditDraftFilters } from '@/app/actions/audit.actions';

interface Area {
    id: string;
    name: string;
}

interface Family {
    id: string;
    name: string;
}

interface PreviewItem {
    id: string;
    name: string;
    sku: string;
    category: string | null;
    baseUnit: string;
    familyName: string | null;
    isBeverage: boolean;
    systemStock: number;
    costPerUnit: number;
}

export function NuevaAuditoriaForm({ areas, categories, families }: {
    areas: Area[];
    categories: string[];
    families: Family[];
}) {
    const router = useRouter();

    // Form state
    const [name, setName] = useState(() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
        return `Inventario ${dateStr}`;
    });
    const [notes, setNotes] = useState('');
    const [selectedAreaId, setSelectedAreaId] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [effectiveDate, setEffectiveDate] = useState('');

    // Preview state
    const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [hasPreview, setHasPreview] = useState(false);

    // Creation state
    const [isCreating, setIsCreating] = useState(false);

    const handlePreview = async () => {
        setIsLoadingPreview(true);
        try {
            const filters: AuditDraftFilters = {};
            if (selectedAreaId) filters.areaId = selectedAreaId;
            if (selectedCategory) filters.category = selectedCategory;

            const items = await getInventoryForAuditAction(filters);
            setPreviewItems(items);
            setHasPreview(true);

            if (items.length === 0) {
                toast.error('No se encontraron productos con los filtros seleccionados');
            }
        } catch (err) {
            toast.error('Error al cargar la vista previa');
        }
        setIsLoadingPreview(false);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error('Ingresa un nombre para la auditoría');
            return;
        }

        setIsCreating(true);
        try {
            const filters: AuditDraftFilters = {};
            if (selectedAreaId) filters.areaId = selectedAreaId;
            if (selectedCategory) filters.category = selectedCategory;

            const result = await createAuditDraftAction({
                name,
                notes,
                areaId: selectedAreaId || undefined,
                effectiveDate: effectiveDate || undefined,
                filters,
            });

            if (result.success && result.auditId) {
                toast.success(`Borrador creado con ${previewItems.length} items`);
                router.push(`/dashboard/inventario/auditorias/${result.auditId}`);
            } else {
                toast.error(result.message || 'Error al crear borrador');
            }
        } catch (err) {
            toast.error('Error al crear la auditoría');
        }
        setIsCreating(false);
    };

    // Group preview items by category
    const groupedItems = previewItems.reduce((acc, item) => {
        const cat = item.category || 'Sin categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, PreviewItem[]>);

    const selectedAreaName = areas.find(a => a.id === selectedAreaId)?.name || 'Todas las áreas';

    return (
        <div className="space-y-6">
            {/* Paso 1: Configuración */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">1</span>
                        Configuración de la Auditoría
                    </h2>
                </div>
                <div className="p-6 space-y-5">
                    {/* Nombre */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Nombre de la Auditoría *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Inventario Semanal Barra"
                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    {/* Filtros en grid */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Área */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                📍 Área / Almacén
                            </label>
                            <select
                                value={selectedAreaId}
                                onChange={(e) => { setSelectedAreaId(e.target.value); setHasPreview(false); }}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Todas las áreas (global)</option>
                                {areas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Categoría */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                🏷️ Categoría
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => { setSelectedCategory(e.target.value); setHasPreview(false); }}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Todas las categorías</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fecha Efectiva + Notas */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                📅 Fecha Efectiva <span className="text-gray-400 font-normal">(opcional, para retroactivas)</span>
                            </label>
                            <input
                                type="date"
                                value={effectiveDate}
                                onChange={(e) => setEffectiveDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                📝 Notas <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Observaciones del inventario..."
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Botón Vista Previa */}
                    <button
                        onClick={handlePreview}
                        disabled={isLoadingPreview}
                        className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                    >
                        {isLoadingPreview ? '⏳ Cargando...' : '🔍 Ver productos que se incluirán'}
                    </button>
                </div>
            </div>

            {/* Paso 2: Vista Previa */}
            {hasPreview && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 animate-fade-in">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">2</span>
                            Vista Previa
                        </h2>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {previewItems.length} productos
                            </span>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {selectedAreaName}
                            </span>
                            {selectedCategory && (
                                <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {selectedCategory}
                                </span>
                            )}
                        </div>
                    </div>

                    {previewItems.length > 0 ? (
                        <>
                            <div className="max-h-[400px] overflow-y-auto">
                                {Object.entries(groupedItems).map(([category, items]) => (
                                    <div key={category}>
                                        <div className="sticky top-0 bg-gray-50 px-6 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                            {category} ({items.length})
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                            {items.map(item => (
                                                <div key={item.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className={cn(
                                                            "flex h-8 w-8 items-center justify-center rounded-lg text-sm flex-shrink-0",
                                                            item.isBeverage
                                                                ? "bg-blue-50 text-blue-500 dark:bg-blue-900/30"
                                                                : "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30"
                                                        )}>
                                                            {item.isBeverage ? '🍺' : '🥩'}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                                            <p className="text-xs text-gray-400">{item.sku}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0 ml-4">
                                                        <p className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-300">
                                                            {item.systemStock.toFixed(2)}
                                                        </p>
                                                        <p className="text-xs text-gray-400">{item.baseUnit}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Crear borrador */}
                            <div className="border-t border-gray-200 p-6 dark:border-gray-700">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Se creará un borrador con <strong>{previewItems.length} productos</strong> para conteo físico.
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            El stock NO se modifica hasta que el gerente apruebe la auditoría.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCreate}
                                        disabled={isCreating || !name.trim()}
                                        className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isCreating ? (
                                            <>
                                                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                                                Creando...
                                            </>
                                        ) : (
                                            <>✅ Crear Borrador de Auditoría</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-12 text-center text-gray-400">
                            <p className="text-4xl mb-3">🔍</p>
                            <p className="font-medium">No se encontraron productos</p>
                            <p className="text-sm mt-1">Intenta con otros filtros</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
