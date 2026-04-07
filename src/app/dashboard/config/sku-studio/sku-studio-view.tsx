'use client';

import { useMemo, useState } from 'react';
import { getTenantName } from '@/config/branding';
import {
    createItemFromStudioAction,
    createProductFamilyAction,
    createSkuTemplateAction,
    deleteProductFamilyAction,
    listProductFamiliesAction,
    listSkuTemplatesAction,
    updateSkuTemplateAction,
} from '@/app/actions/sku-studio.actions';
import {
    BASE_UNIT_OPTIONS,
    INVENTORY_TYPE_OPTIONS,
    PRODUCT_ROLE_OPTIONS,
    STOCK_TRACKING_OPTIONS,
} from '@/lib/constants/sku-studio';
import type { InventoryTypeValue } from '@/lib/constants/sku-studio';

type FamilyRow = {
    id: string;
    name: string;
    parentId: string | null;
    sortOrder: number;
    icon: string | null;
    color: string | null;
    parent: { id: string; name: string } | null;
};

type TemplateRow = {
    id: string;
    name: string;
    familyId: string | null;
    description: string | null;
    presetType: string;
    presetBaseUnit: string;
    presetStockTrackingMode: string | null;
    presetProductRole: string | null;
    skuPrefix: string | null;
    isBeverage: boolean;
    sortOrder: number;
    isActive: boolean;
    family: { id: string; name: string } | null;
};

const TABS = [
    { id: 'create' as const, label: 'Nuevo SKU', emoji: '✨' },
    { id: 'families' as const, label: 'Familias', emoji: '📁' },
    { id: 'templates' as const, label: 'Plantillas', emoji: '📋' },
];

export default function SkuStudioView({
    initialFamilies,
    initialTemplates,
}: {
    initialFamilies: FamilyRow[];
    initialTemplates: TemplateRow[];
}) {
    const [tab, setTab] = useState<(typeof TABS)[number]['id']>('create');
    const [families, setFamilies] = useState(initialFamilies);
    const [templates, setTemplates] = useState(initialTemplates);

    const [name, setName] = useState('');
    const [familyId, setFamilyId] = useState<string>('');
    const [templateId, setTemplateId] = useState<string>('');
    const [type, setType] = useState<InventoryTypeValue>('RAW_MATERIAL');
    const [baseUnit, setBaseUnit] = useState<string>('KG');
    const [stockMode, setStockMode] = useState<string>('UNIT');
    const [productRole, setProductRole] = useState<string>('');
    const [skuPrefix, setSkuPrefix] = useState('');
    const [isBeverage, setIsBeverage] = useState(false);
    const [initialCost, setInitialCost] = useState('');
    const [saving, setSaving] = useState(false);

    const [newFamilyName, setNewFamilyName] = useState('');
    const [newFamilyParent, setNewFamilyParent] = useState<string>('');
    const [tplForm, setTplForm] = useState({
        name: '',
        familyId: '',
        presetType: 'RAW_MATERIAL',
        presetBaseUnit: 'KG',
        presetStockTrackingMode: 'UNIT',
        presetProductRole: '',
        skuPrefix: '',
        isBeverage: false,
    });

    const refreshFamilies = async () => {
        const res = await listProductFamiliesAction();
        if (res.success && res.data) setFamilies(res.data as unknown as FamilyRow[]);
    };

    const refreshTemplates = async () => {
        const res = await listSkuTemplatesAction();
        if (res.success && res.data) setTemplates(res.data as unknown as TemplateRow[]);
    };

    const familyOptions = useMemo(
        () =>
            families.map(f => ({
                id: f.id,
                label: f.parent ? `${f.parent.name} › ${f.name}` : f.name,
            })),
        [families]
    );

    const applyTemplate = (tid: string) => {
        setTemplateId(tid);
        if (!tid) return;
        const t = templates.find(x => x.id === tid);
        if (!t) return;
        setType(t.presetType as InventoryTypeValue);
        setBaseUnit(t.presetBaseUnit);
        setStockMode(t.presetStockTrackingMode || 'UNIT');
        setProductRole(t.presetProductRole || '');
        setSkuPrefix(t.skuPrefix || '');
        setIsBeverage(t.isBeverage);
        if (t.familyId) setFamilyId(t.familyId);
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await createItemFromStudioAction({
                name,
                familyId: familyId || undefined,
                templateId: templateId || undefined,
                type,
                baseUnit,
                stockTrackingMode: stockMode || null,
                productRole: productRole || null,
                skuPrefix: skuPrefix || null,
                isBeverage,
                initialCost: initialCost ? parseFloat(initialCost.replace(',', '.')) : undefined,
            });
            if (res.success) {
                setName('');
                alert(res.message || 'Listo');
            } else alert(res.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createProductFamilyAction({
            name: newFamilyName,
            parentId: newFamilyParent || null,
        });
        if (res.success) {
            setNewFamilyName('');
            await refreshFamilies();
        } else alert(res.message);
    };

    const handleDeleteFamily = async (id: string) => {
        if (!confirm('¿Eliminar esta familia?')) return;
        const res = await deleteProductFamilyAction(id);
        if (res.success) await refreshFamilies();
        else alert(res.message);
    };

    const handleAddTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createSkuTemplateAction({
            name: tplForm.name,
            familyId: tplForm.familyId || null,
            presetType: tplForm.presetType,
            presetBaseUnit: tplForm.presetBaseUnit,
            presetStockTrackingMode: tplForm.presetStockTrackingMode || null,
            presetProductRole: tplForm.presetProductRole || null,
            skuPrefix: tplForm.skuPrefix || null,
            isBeverage: tplForm.isBeverage,
        });
        if (res.success) {
            setTplForm({
                name: '',
                familyId: '',
                presetType: 'RAW_MATERIAL',
                presetBaseUnit: 'KG',
                presetStockTrackingMode: 'UNIT',
                presetProductRole: '',
                skuPrefix: '',
                isBeverage: false,
            });
            await refreshTemplates();
        } else alert(res.message);
    };

    const toggleTemplateActive = async (row: TemplateRow) => {
        const res = await updateSkuTemplateAction(row.id, { isActive: !row.isActive });
        if (res.success) await refreshTemplates();
        else alert('No se pudo actualizar');
    };

    const chipClass = (active: boolean) =>
        `rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
            active
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200'
        }`;

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SKU Studio</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Creación guiada de productos con familias y plantillas. Solo dueño o admin {getTenantName()}.
                    Pensado para restaurantes con alta rotación de carta.
                </p>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                            tab === t.id
                                ? 'bg-primary/15 text-primary'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                    >
                        <span>{t.emoji}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'create' && (
                <form
                    onSubmit={handleCreateItem}
                    className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo producto / SKU</h2>

                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500">Nombre del ítem</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej. Pechuga deshuesada MAP"
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            required
                        />
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">Plantilla (opcional)</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => applyTemplate('')}
                                className={chipClass(!templateId)}
                            >
                                Sin plantilla
                            </button>
                            {templates
                                .filter(t => t.isActive)
                                .map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => applyTemplate(t.id)}
                                        className={chipClass(templateId === t.id)}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Al elegir plantilla se rellenan tipo, unidad y prefijo; puedes ajustar después con los chips.
                        </p>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">Familia / categoría</p>
                        <select
                            value={familyId}
                            onChange={e => setFamilyId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        >
                            <option value="">— Sin familia —</option>
                            {familyOptions.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">Tipo de inventario</p>
                        <div className="flex flex-wrap gap-2">
                            {INVENTORY_TYPE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value)}
                                    className={chipClass(type === opt.value)}
                                >
                                    {opt.emoji} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase text-gray-500">Rol operativo (opcional)</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setProductRole('')}
                                className={chipClass(!productRole)}
                            >
                                Ninguno
                            </button>
                            {PRODUCT_ROLE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setProductRole(opt.value)}
                                    className={chipClass(productRole === opt.value)}
                                >
                                    {opt.emoji} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase text-gray-500">Unidad base</p>
                            <div className="flex flex-wrap gap-2">
                                {BASE_UNIT_OPTIONS.map(u => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => setBaseUnit(u)}
                                        className={chipClass(baseUnit === u)}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase text-gray-500">Seguimiento de stock</p>
                            <div className="flex flex-wrap gap-2">
                                {STOCK_TRACKING_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setStockMode(opt.value)}
                                        className={chipClass(stockMode === opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={isBeverage}
                                onChange={e => setIsBeverage(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Bebida (marca para reportes de bar)
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Prefijo SKU (opcional)</label>
                            <input
                                value={skuPrefix}
                                onChange={e => setSkuPrefix(e.target.value)}
                                placeholder="Ej. CARN"
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 uppercase dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Costo inicial (opcional)</label>
                            <input
                                type="number"
                                step="any"
                                min={0}
                                value={initialCost}
                                onChange={e => setInitialCost(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow hover:opacity-95 disabled:opacity-60 sm:w-auto sm:px-8"
                    >
                        {saving ? 'Creando…' : 'Crear ítem en inventario'}
                    </button>
                </form>
            )}

            {tab === 'families' && (
                <div className="space-y-6">
                    <form
                        onSubmit={handleAddFamily}
                        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Nueva familia o subcategoría</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Nombre</label>
                                <input
                                    value={newFamilyName}
                                    onChange={e => setNewFamilyName(e.target.value)}
                                    placeholder="Carnes frescas, Salsas, Bar…"
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Dentro de (opcional)</label>
                                <select
                                    value={newFamilyParent}
                                    onChange={e => setNewFamilyParent(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                >
                                    <option value="">— Raíz —</option>
                                    {families.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.parent ? `${f.parent.name} › ${f.name}` : f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                        >
                            Guardar familia
                        </button>
                    </form>

                    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Familias activas</h3>
                        </div>
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {families.length === 0 && (
                                <li className="px-4 py-6 text-sm text-gray-500">Aún no hay familias. Crea la primera arriba.</li>
                            )}
                            {families.map(f => (
                                <li
                                    key={f.id}
                                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                                >
                                    <span className="text-gray-900 dark:text-white">
                                        {f.parent ? (
                                            <>
                                                <span className="text-gray-500">{f.parent.name}</span>
                                                <span className="mx-1">›</span>
                                                <strong>{f.name}</strong>
                                            </>
                                        ) : (
                                            <strong>{f.name}</strong>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteFamily(f.id)}
                                        className="text-xs font-semibold text-red-600 hover:underline"
                                    >
                                        Eliminar
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {tab === 'templates' && (
                <div className="space-y-6">
                    <form
                        onSubmit={handleAddTemplate}
                        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Nueva plantilla</h2>
                        <p className="mb-4 text-sm text-gray-500">
                            Las plantillas guardan valores por defecto para crear SKUs en un clic (ideal para familias de
                            productos repetitivos).
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="text-xs font-bold uppercase text-gray-500">Nombre de la plantilla</label>
                                <input
                                    value={tplForm.name}
                                    onChange={e => setTplForm({ ...tplForm, name: e.target.value })}
                                    placeholder="Ej. Insumo cárnico KG"
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Familia sugerida</label>
                                <select
                                    value={tplForm.familyId}
                                    onChange={e => setTplForm({ ...tplForm, familyId: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                >
                                    <option value="">— Cualquiera —</option>
                                    {families.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.parent ? `${f.parent.name} › ${f.name}` : f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Prefijo SKU</label>
                                <input
                                    value={tplForm.skuPrefix}
                                    onChange={e => setTplForm({ ...tplForm, skuPrefix: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Tipo</label>
                                <select
                                    value={tplForm.presetType}
                                    onChange={e => setTplForm({ ...tplForm, presetType: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                >
                                    {INVENTORY_TYPE_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Unidad base</label>
                                <select
                                    value={tplForm.presetBaseUnit}
                                    onChange={e => setTplForm({ ...tplForm, presetBaseUnit: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                >
                                    {BASE_UNIT_OPTIONS.map(u => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-gray-500">Stock</label>
                                <select
                                    value={tplForm.presetStockTrackingMode}
                                    onChange={e =>
                                        setTplForm({ ...tplForm, presetStockTrackingMode: e.target.value })
                                    }
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                >
                                    {STOCK_TRACKING_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end pb-2">
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={tplForm.isBeverage}
                                        onChange={e => setTplForm({ ...tplForm, isBeverage: e.target.checked })}
                                    />
                                    Bebida
                                </label>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                        >
                            Guardar plantilla
                        </button>
                    </form>

                    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-4 py-3">Plantilla</th>
                                    <th className="px-4 py-3">Familia</th>
                                    <th className="px-4 py-3">Tipo / Unidad</th>
                                    <th className="px-4 py-3">Prefijo</th>
                                    <th className="px-4 py-3">Activa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {templates.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-gray-500">
                                            No hay plantillas. Crea una arriba o vuelve cuando tengas familias definidas.
                                        </td>
                                    </tr>
                                )}
                                {templates.map(row => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                            {row.family?.name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                            {row.presetType} / {row.presetBaseUnit}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">{row.skuPrefix || '—'}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleTemplateActive(row)}
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    row.isActive
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                {row.isActive ? 'Sí' : 'No'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
