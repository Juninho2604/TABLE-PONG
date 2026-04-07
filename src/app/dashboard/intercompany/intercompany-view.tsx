'use client';

import { useState, useTransition } from 'react';
import {
    bulkSetMenuItemPartnerAction,
    getPartnerSalesReportAction,
    upsertPartnerAction,
    type PartnerSalesReport,
    type PartnerSummary,
} from '@/app/actions/intercompany.actions';
import { getTenantName } from '@/config/branding';

interface MenuItem {
    id: string;
    sku: string;
    name: string;
    price: number;
    isIntercompany: boolean;
    intercompanySupplierId: string | null;
    intercompanySupplier: { id: string; name: string } | null;
    category: { name: string };
}

interface Props {
    partners: PartnerSummary[];
    menuItems: MenuItem[];
}

const TAB = { PARTNERS: 'PARTNERS', ITEMS: 'ITEMS', REPORT: 'REPORT' } as const;
type ActiveTab = typeof TAB[keyof typeof TAB];

export default function IntercompanyView({ partners: initialPartners, menuItems: initialItems }: Props) {
    const [activeTab, setActiveTab] = useState<ActiveTab>(TAB.PARTNERS);
    const [partners, setPartners] = useState(initialPartners);
    const [menuItems] = useState(initialItems);
    const [isPending, startTransition] = useTransition();

    // ── Partner form ─────────────────────────────────────────────────────────
    const [showPartnerForm, setShowPartnerForm] = useState(false);
    const [partnerForm, setPartnerForm] = useState({ id: '', name: '', code: '', intercompanyCode: '', contactName: '', phone: '', email: '', notes: '' });

    // ── Item assignment ───────────────────────────────────────────────────────
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [itemFilter, setItemFilter] = useState('');

    // ── Report ────────────────────────────────────────────────────────────────
    const [reportPartnerId, setReportPartnerId] = useState('');
    const [reportStart, setReportStart] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
    });
    const [reportEnd, setReportEnd] = useState(() => new Date().toISOString().split('T')[0]);
    const [report, setReport] = useState<PartnerSalesReport | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState('');

    function openNewPartner() {
        setPartnerForm({ id: '', name: '', code: '', intercompanyCode: '', contactName: '', phone: '', email: '', notes: '' });
        setShowPartnerForm(true);
    }

    function openEditPartner(p: PartnerSummary) {
        setPartnerForm({ id: p.id, name: p.name, code: p.code || '', intercompanyCode: p.intercompanyCode || '', contactName: '', phone: '', email: '', notes: '' });
        setShowPartnerForm(true);
    }

    async function handleSavePartner() {
        startTransition(async () => {
            const r = await upsertPartnerAction(partnerForm);
            if (r.success) {
                setShowPartnerForm(false);
                window.location.reload();
            } else {
                alert(r.message);
            }
        });
    }

    async function handleBulkAssign() {
        if (!selectedPartnerId || selectedItems.size === 0) return;
        startTransition(async () => {
            const r = await bulkSetMenuItemPartnerAction(Array.from(selectedItems), selectedPartnerId || null);
            if (r.success) {
                alert(r.message);
                window.location.reload();
            } else {
                alert(r.message);
            }
        });
    }

    async function handleBulkRemove() {
        if (selectedItems.size === 0) return;
        if (!confirm('Quitar el aliado de los items seleccionados?')) return;
        startTransition(async () => {
            const r = await bulkSetMenuItemPartnerAction(Array.from(selectedItems), null);
            if (r.success) {
                alert(r.message);
                window.location.reload();
            } else {
                alert(r.message);
            }
        });
    }

    async function handleGenerateReport() {
        if (!reportPartnerId) { setReportError('Selecciona un aliado'); return; }
        setReportLoading(true);
        setReportError('');
        setReport(null);
        try {
            const r = await getPartnerSalesReportAction(
                reportPartnerId,
                new Date(reportStart + 'T00:00:00'),
                new Date(reportEnd + 'T23:59:59'),
            );
            if (r.success && r.data) setReport(r.data);
            else setReportError(r.message || 'Error generando reporte');
        } catch {
            setReportError('Error de conexión');
        } finally {
            setReportLoading(false);
        }
    }

    const filteredItems = menuItems.filter(i =>
        !itemFilter || i.name.toLowerCase().includes(itemFilter.toLowerCase()) || i.category.name.toLowerCase().includes(itemFilter.toLowerCase())
    );

    const toggleItem = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAllVisible = () => setSelectedItems(new Set(filteredItems.map(i => i.id)));
    const clearSelection = () => setSelectedItems(new Set());

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-white">Aliados Comerciales</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Gestiona aliados como Shanklish Caracas — sus ventas se registran en la factura TP pero la contabilidad se lleva separada.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-800">
                    {[
                        { key: TAB.PARTNERS, label: 'Aliados', count: partners.length },
                        { key: TAB.ITEMS, label: 'Items del Menú', count: menuItems.filter(i => i.isIntercompany).length },
                        { key: TAB.REPORT, label: 'Reporte de Ventas' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition -mb-px ${activeTab === t.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                        >
                            {t.label}
                            {t.count !== undefined && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${activeTab === t.key ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── PARTNERS TAB ─────────────────────────────────────────── */}
                {activeTab === TAB.PARTNERS && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button onClick={openNewPartner} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold transition">
                                + Nuevo aliado
                            </button>
                        </div>

                        {partners.length === 0 ? (
                            <div className="bg-slate-900 rounded-xl p-8 text-center text-slate-500">
                                <div className="text-4xl mb-2">🤝</div>
                                <p className="font-bold">No hay aliados configurados</p>
                                <p className="text-sm mt-1">Crea el primero para empezar a registrar ventas de aliados en {getTenantName()}</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {partners.map(p => (
                                    <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-lg">{p.name}</span>
                                                    {p.isActive ? (
                                                        <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Activo</span>
                                                    ) : (
                                                        <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Inactivo</span>
                                                    )}
                                                </div>
                                                {p.code && <p className="text-slate-500 text-xs mt-0.5">Código: {p.code}</p>}
                                                {p.intercompanyCode && <p className="text-slate-500 text-xs">ID intercompany: {p.intercompanyCode}</p>}
                                            </div>
                                            <button onClick={() => openEditPartner(p)} className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded border border-slate-700 hover:border-slate-500 transition">
                                                Editar
                                            </button>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-800 flex gap-4 text-sm">
                                            <div>
                                                <div className="text-slate-400 text-xs">Items en menú</div>
                                                <div className="font-bold text-amber-400">{p.menuItemCount}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-400 text-xs">Tipo</div>
                                                <div className="font-bold text-slate-300">Intercompany</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ITEMS TAB ────────────────────────────────────────────── */}
                {activeTab === TAB.ITEMS && (
                    <div className="space-y-4">
                        {/* Toolbar */}
                        <div className="bg-slate-900 rounded-xl p-4 space-y-3">
                            <div className="flex flex-wrap gap-3 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-xs text-slate-400 font-bold block mb-1">Filtrar items</label>
                                    <input
                                        value={itemFilter}
                                        onChange={e => setItemFilter(e.target.value)}
                                        placeholder="Buscar por nombre o categoría..."
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-xs text-slate-400 font-bold block mb-1">Asignar a aliado</label>
                                    <select
                                        value={selectedPartnerId}
                                        onChange={e => setSelectedPartnerId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="">— Seleccionar aliado —</option>
                                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={selectAllVisible} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 font-bold transition">
                                    Seleccionar visibles ({filteredItems.length})
                                </button>
                                <button onClick={clearSelection} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 font-bold transition">
                                    Limpiar selección
                                </button>
                                {selectedItems.size > 0 && (
                                    <>
                                        <button
                                            onClick={handleBulkAssign}
                                            disabled={!selectedPartnerId || isPending}
                                            className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold transition disabled:opacity-40"
                                        >
                                            Asignar {selectedItems.size} item(s) a aliado
                                        </button>
                                        <button
                                            onClick={handleBulkRemove}
                                            disabled={isPending}
                                            className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded-lg border border-red-700 font-bold transition disabled:opacity-40"
                                        >
                                            Quitar aliado de {selectedItems.size} item(s)
                                        </button>
                                    </>
                                )}
                            </div>
                            {selectedItems.size > 0 && (
                                <p className="text-xs text-amber-400">{selectedItems.size} item(s) seleccionados</p>
                            )}
                        </div>

                        {/* Items list */}
                        <div className="bg-slate-900 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                                        <th className="text-left px-4 py-3 w-8">
                                            <input type="checkbox"
                                                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                                                onChange={e => e.target.checked ? selectAllVisible() : clearSelection()}
                                                className="accent-amber-500"
                                            />
                                        </th>
                                        <th className="text-left px-4 py-3">Item</th>
                                        <th className="text-left px-4 py-3">Categoría</th>
                                        <th className="text-right px-4 py-3">Precio</th>
                                        <th className="text-left px-4 py-3">Aliado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => (
                                        <tr
                                            key={item.id}
                                            onClick={() => toggleItem(item.id)}
                                            className={`border-b border-slate-800/50 cursor-pointer transition ${selectedItems.has(item.id) ? 'bg-amber-950/30' : 'hover:bg-slate-800/50'}`}
                                        >
                                            <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(item.id)}
                                                    onChange={() => toggleItem(item.id)}
                                                    className="accent-amber-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-slate-500 text-xs">{item.sku}</div>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-400">{item.category.name}</td>
                                            <td className="px-4 py-2.5 text-right font-bold">${item.price.toFixed(2)}</td>
                                            <td className="px-4 py-2.5">
                                                {item.isIntercompany && item.intercompanySupplier ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 text-xs font-bold">
                                                        🤝 {item.intercompanySupplier.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600 text-xs">— propio TP —</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredItems.length === 0 && (
                                <div className="text-center text-slate-500 py-8">No hay items que coincidan</div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── REPORT TAB ────────────────────────────────────────────── */}
                {activeTab === TAB.REPORT && (
                    <div className="space-y-4">
                        {/* Filtros */}
                        <div className="bg-slate-900 rounded-xl p-4 space-y-3">
                            <h3 className="font-bold text-slate-300">Generar reporte de ventas por aliado</h3>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex-1 min-w-[180px]">
                                    <label className="text-xs text-slate-400 font-bold block mb-1">Aliado</label>
                                    <select
                                        value={reportPartnerId}
                                        onChange={e => setReportPartnerId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-bold block mb-1">Desde</label>
                                    <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 font-bold block mb-1">Hasta</label>
                                    <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none" />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={reportLoading}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold transition disabled:opacity-40"
                                    >
                                        {reportLoading ? 'Generando...' : 'Generar reporte'}
                                    </button>
                                </div>
                            </div>
                            {reportError && <p className="text-red-400 text-sm">{reportError}</p>}
                        </div>

                        {report && (
                            <div className="space-y-4">
                                {/* Header reporte */}
                                <div className="bg-slate-900 rounded-xl p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-xl font-black text-white">{report.partnerName}</h2>
                                            <p className="text-slate-400 text-sm">{new Date(report.periodStart).toLocaleDateString('es-VE')} — {new Date(report.periodEnd).toLocaleDateString('es-VE')}</p>
                                        </div>
                                        <span className="px-3 py-1 rounded-full bg-amber-900 text-amber-300 text-xs font-bold">Intercompany</span>
                                    </div>
                                </div>

                                {/* KPIs */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Ventas brutas', value: `$${report.totalGrossSales.toFixed(2)}`, sub: 'Total consumo clientes', color: 'text-emerald-400' },
                                        { label: 'Monto adeudado al aliado', value: `$${report.totalNetOwedToPartner.toFixed(2)}`, sub: 'Lo que TP debe a Shanklish', color: 'text-red-400' },
                                        { label: 'Órdenes', value: report.orderCount.toString(), sub: 'Tickets con items del aliado', color: 'text-blue-400' },
                                        { label: 'Unidades vendidas', value: report.itemCount.toString(), sub: 'Items del aliado despachados', color: 'text-amber-400' },
                                    ].map(kpi => (
                                        <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                            <div className="text-slate-400 text-xs font-bold uppercase mb-1">{kpi.label}</div>
                                            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{kpi.sub}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Nota de servicio */}
                                <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 text-sm text-amber-300">
                                    <div className="font-bold mb-1">Nota sobre el 10% de servicio</div>
                                    <p className="text-amber-400/80 text-xs">
                                        El cargo de servicio (10% u otro) aplicado en las cuentas se registra a nivel de cada cobro (PaymentSplit) y <strong>queda íntegramente en {getTenantName()}</strong>.
                                        El monto adeudado al aliado es el total de consumo bruto sin servicio.
                                        Las propinas adicionales dejadas por clientes también quedan en {getTenantName()}.
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Items más vendidos */}
                                    <div className="bg-slate-900 rounded-xl p-4">
                                        <h3 className="font-bold text-slate-300 mb-3">Top items vendidos</h3>
                                        <div className="space-y-2">
                                            {report.topItems.map((item, i) => (
                                                <div key={item.name} className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-xs w-5">{i + 1}.</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">{item.name}</div>
                                                        <div className="text-slate-500 text-xs">{item.qty} unidades</div>
                                                    </div>
                                                    <span className="font-bold text-emerald-400 text-sm">${item.total.toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {report.topItems.length === 0 && <p className="text-slate-500 text-sm">Sin datos de items</p>}
                                        </div>
                                    </div>

                                    {/* Ventas por método de pago */}
                                    <div className="bg-slate-900 rounded-xl p-4">
                                        <h3 className="font-bold text-slate-300 mb-3">Ventas por método de pago</h3>
                                        <div className="space-y-2">
                                            {report.salesByMethod.map(m => (
                                                <div key={m.method} className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-medium">{m.method}</div>
                                                        <div className="text-slate-500 text-xs">{m.count} transacciones</div>
                                                    </div>
                                                    <span className="font-bold text-emerald-400">${m.total.toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {report.salesByMethod.length === 0 && <p className="text-slate-500 text-sm">Sin datos</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Modal: Partner Form ──────────────────────────────────────── */}
            {showPartnerForm && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="border-b border-slate-800 p-5 flex items-center justify-between">
                            <h3 className="text-lg font-black">{partnerForm.id ? 'Editar aliado' : 'Nuevo aliado comercial'}</h3>
                            <button onClick={() => setShowPartnerForm(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
                        </div>
                        <div className="p-5 space-y-3">
                            {[
                                { field: 'name', label: 'Nombre del aliado *', placeholder: 'Ej: Shanklish Caracas' },
                                { field: 'code', label: 'Código interno', placeholder: 'Ej: SHANKLISH' },
                                { field: 'intercompanyCode', label: 'ID intercompany', placeholder: 'Ej: SC-001' },
                                { field: 'contactName', label: 'Contacto', placeholder: 'Nombre de contacto' },
                                { field: 'phone', label: 'Teléfono', placeholder: '+58...' },
                                { field: 'email', label: 'Email', placeholder: 'contacto@aliado.com' },
                            ].map(({ field, label, placeholder }) => (
                                <div key={field}>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">{label}</label>
                                    <input
                                        value={(partnerForm as any)[field]}
                                        onChange={e => setPartnerForm(f => ({ ...f, [field]: e.target.value }))}
                                        placeholder={placeholder}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">Notas</label>
                                <textarea
                                    value={partnerForm.notes}
                                    onChange={e => setPartnerForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Acuerdos, condiciones especiales..."
                                    rows={2}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="border-t border-slate-800 p-4 flex gap-3">
                            <button onClick={() => setShowPartnerForm(false)} className="flex-1 py-2.5 bg-slate-800 rounded-xl font-bold text-sm">Cancelar</button>
                            <button
                                onClick={handleSavePartner}
                                disabled={!partnerForm.name || isPending}
                                className="flex-[2] py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-black text-sm transition disabled:opacity-40"
                            >
                                {isPending ? 'Guardando...' : 'Guardar aliado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
