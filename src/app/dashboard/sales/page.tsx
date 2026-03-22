'use client';

import React, { useState, useEffect } from 'react';
import { getSalesHistoryAction, getDailyZReportAction, getOrderForReceiptAction, type ZReportData } from '@/app/actions/sales.actions';
import { voidSalesOrderAction } from '@/app/actions/sales-entry.actions';
import { printReceipt } from '@/lib/print-command';
import { useAuthStore } from '@/stores/auth.store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

const MANAGER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'GERENTE_ADMIN', 'GERENTE_OPS'];
const VOID_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'GERENTE_ADMIN', 'GERENTE_OPS', 'AUDITOR', 'CASHIER_RESTAURANT', 'CASHIER_DELIVERY', 'AREA_LEAD', 'JEFE_AREA', 'CHEF', 'HR_MANAGER', 'RRHH'];
const CARACAS_TZ = 'America/Caracas';


export default function SalesHistoryPage() {
    const { user } = useAuthStore();
    const [sales, setSales] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zReport, setZReport] = useState<ZReportData | null>(null);
    const [showZReport, setShowZReport] = useState(false);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [voidingId, setVoidingId] = useState<string | null>(null);
    const [voidModalSale, setVoidModalSale] = useState<any | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voidPin, setVoidPin] = useState('');
    const [dateFilter, setDateFilter] = useState<string>(() => {
        // Default: hoy en hora Caracas
        return new Date().toLocaleDateString('sv-SE', { timeZone: CARACAS_TZ });
    });
    const canPrint = user && MANAGER_ROLES.includes(user.role);
    const canVoid = user && VOID_ROLES.includes(user.role);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const result = await getSalesHistoryAction();
        if (result.success && result.data) {
            setSales(result.data);
        }
        setIsLoading(false);
    };

    // Filtra las ventas en el cliente según la fecha seleccionada (zona Caracas)
    const filteredSales = dateFilter
        ? sales.filter(s => {
            if (!s.createdAt) return false;
            const d = new Date(s.createdAt).toLocaleDateString('sv-SE', { timeZone: CARACAS_TZ });
            return d === dateFilter;
          })
        : sales;

    const handleGenerateZReport = async () => {
        const result = await getDailyZReportAction();
        if (result.success && result.data) {
            setZReport(result.data);
            setShowZReport(true);
        } else {
            alert('Error generando reporte');
        }
    };


    const formatSaleDate = (dateValue: string | Date | null | undefined) => {
        if (!dateValue) return '';
        return new Date(dateValue).toLocaleDateString('es-VE', { timeZone: CARACAS_TZ });
    };

    const formatSaleTime = (dateValue: string | Date | null | undefined) => {
        if (!dateValue) return '';
        return new Date(dateValue).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: CARACAS_TZ });
    };

    const handleExportExcel = () => {
        if (!sales.length) return;

        // Hoja 1: Resumen de ventas (una fila por orden)
        const summaryRows = sales.map(sale => ({
            'Orden #': sale.orderNumber,
            'Fecha': formatSaleDate(sale.createdAt),
            'Hora': formatSaleTime(sale.createdAt),
            'Cliente': sale.customerName || 'Cliente General',
            'Tipo': sale.orderType === 'RESTAURANT' ? 'Restaurante' : sale.orderType === 'DELIVERY' ? 'Delivery' : sale.orderType,
            'Canal': sale.sourceChannel || '',
            'Método de Pago': getPaymentLabel(sale.paymentMethod),
            'Subtotal ($)': Number(sale.subtotal).toFixed(2),
            'Descuento ($)': Number(sale.discount).toFixed(2),
            'Tipo Descuento': sale.discountType || '',
            'Total ($)': Number(sale.total).toFixed(2),
            'Estado': sale.status,
            'Estado Pago': sale.paymentStatus,
            'Registrado por': sale.createdBy ? `${sale.createdBy.firstName} ${sale.createdBy.lastName}` : '',
            'Autorizado por': sale.authorizedBy ? `${sale.authorizedBy.firstName} ${sale.authorizedBy.lastName}` : '',
            'Notas': sale.notes || '',
            'Anulada': sale.status === 'CANCELLED' ? 'Sí' : 'No',
            'Justificación anulación': sale.voidReason || '',
            'Anulada por': sale.voidedBy ? `${sale.voidedBy.firstName} ${sale.voidedBy.lastName}` : '',
            'Fecha anulación': sale.voidedAt ? formatSaleDate(sale.voidedAt) + ' ' + formatSaleTime(sale.voidedAt) : '',
        }));

        // Hoja 2: Detalle de ítems (una fila por ítem vendido)
        const itemRows: any[] = [];
        for (const sale of sales) {
            if (!sale.items || sale.items.length === 0) {
                itemRows.push({
                    'Orden #': sale.orderNumber,
                    'Fecha': formatSaleDate(sale.createdAt),
                    'Hora': formatSaleTime(sale.createdAt),
                    'Producto': '(sin detalle)',
                    'Cantidad': '',
                    'Precio Unit. ($)': '',
                    'Subtotal Ítem ($)': '',
                    'Notas Ítem': '',
                    'Método de Pago': getPaymentLabel(sale.paymentMethod),
                    'Total Orden ($)': Number(sale.total).toFixed(2),
                });
            } else {
                for (const item of sale.items) {
                    itemRows.push({
                        'Orden #': sale.orderNumber,
                        'Fecha': formatSaleDate(sale.createdAt),
                        'Hora': formatSaleTime(sale.createdAt),
                        'Producto': item.itemName,
                        'Cantidad': item.quantity,
                        'Precio Unit. ($)': Number(item.unitPrice).toFixed(2),
                        'Subtotal Ítem ($)': Number(item.lineTotal).toFixed(2),
                        'Notas Ítem': item.notes || '',
                        'Método de Pago': getPaymentLabel(sale.paymentMethod),
                        'Total Orden ($)': Number(sale.total).toFixed(2),
                    });
                }
            }
        }

        const wb = XLSX.utils.book_new();

        const ws1 = XLSX.utils.json_to_sheet(summaryRows);
        // Ajustar anchos de columna
        ws1['!cols'] = [
            { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 12 },
            { wch: 16 }, { wch: 15 }, { wch: 12 }, { wch: 13 }, { wch: 15 },
            { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
        ];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Ventas');

        const ws2 = XLSX.utils.json_to_sheet(itemRows);
        ws2['!cols'] = [
            { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 10 },
            { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 15 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Ítems');

        const today = formatSaleDate(new Date()).replaceAll('/', '-');
        XLSX.writeFile(wb, `historial_ventas_${today}.xlsx`);
    };

    const getPaymentLabel = (method: string) => {
        switch (method) {
            case 'CASH': return 'Efectivo';
            case 'CARD': return 'Punto de Venta';
            case 'TRANSFER': return 'Transferencia';
            case 'MOBILE_PAY': return 'Pago Móvil';
            case 'MULTIPLE': return 'Mixto';
            default: return method || '-';
        }
    };

    const getPaymentBadge = (method: string) => {
        switch (method) {
            case 'CASH': return <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs font-bold">EFECTIVO</span>;
            case 'CARD': return <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs font-bold">PUNTO</span>;
            case 'TRANSFER': return <span className="bg-indigo-900 text-indigo-300 px-2 py-1 rounded text-xs font-bold">TRANSFER</span>;
            case 'MOBILE_PAY': return <span className="bg-purple-900 text-purple-300 px-2 py-1 rounded text-xs font-bold">PAGO MÓVIL</span>;
            default: return <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-bold">{method}</span>;
        }
    };

    const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;

    // Detecta si una orden de Sport Bar cobró el 10% de servicio
    const getServiceChargeInfo = (sale: any): { charged: boolean; amount: number } => {
        const splits: any[] = sale.openTab?.paymentSplits || [];
        let sum = 0;
        for (const s of splits) {
            const sc = Number(s.serviceChargeAmount);
            if (!Number.isNaN(sc) && sc > 0.005) sum += sc;
        }
        if (sum > 0) return { charged: true, amount: sum };
        for (const s of splits) {
            const label: string = s.splitLabel || '';
            const match = label.match(/\+10% serv \(\$([\d.]+)\)/);
            if (match) return { charged: true, amount: parseFloat(match[1]) };
            if (label.includes('+10% serv')) return { charged: true, amount: Number(s.paidAmount) * 0.10 / 1.10 };
        }
        return { charged: false, amount: 0 };
    };

    /** Propina voluntaria / vuelto a propina (no el cargo por servicio) */
    const getExtraTipTotal = (sale: any): number => {
        const splits: any[] = sale.openTab?.paymentSplits || [];
        if (!splits.length) return 0;
        return splits.reduce((s: number, p: any) => s + (Number(p.tipAmount) || 0), 0);
    };

    // Extrae splits de pago desde el campo notes (pagos mixtos Pick Up)
    const parseSplitsFromNotes = (notes: string | null): Record<string, number> | null => {
        if (!notes) return null;
        const m = notes.match(/SPLITS:(\{[^}]+\})/);
        if (!m) return null;
        try { return JSON.parse(m[1]); } catch { return null; }
    };

    const PAYMENT_ICONS: Record<string, string> = {
        CASH: '💵', CARD: '💳', MOBILE_PAY: '📱', TRANSFER: '🏦',
    };

    // Calcula el total cobrado real para una orden
    const getAmountPaid = (sale: any): number => {
        // Sport Bar: efectivo real = amountReceived si existe; si no paidAmount + propina extra
        if (sale.openTab?.paymentSplits?.length) {
            return sale.openTab.paymentSplits.reduce((s: number, p: any) => {
                const ar = Number(p.amountReceived);
                if (!Number.isNaN(ar) && ar > 0.005) return s + ar;
                const pa = Number(p.paidAmount) || 0;
                const tip = Number(p.tipAmount) || 0;
                return s + pa + tip;
            }, 0);
        }
        return Number(sale.amountPaid) || Number(sale.total);
    };

    const handlePrintReceipt = async (sale: any) => {
        if (!canPrint) return;
        setPrintingId(sale.id);
        try {
            const res = await getOrderForReceiptAction(sale.id);
            if (!res.success || !res.data) {
                alert(res.message || 'Error al cargar la orden');
                return;
            }
            const o = res.data;
            const cashierName = o.createdBy ? `${o.createdBy.firstName} ${o.createdBy.lastName}` : 'Sistema';
            printReceipt({
                orderNumber: o.orderNumber,
                orderType: o.orderType === 'DELIVERY' ? 'DELIVERY' : 'RESTAURANT',
                date: o.createdAt,
                cashierName,
                customerName: o.customerName ?? undefined,
                customerAddress: o.customerAddress ?? undefined,
                items: o.items.map((i: any) => ({
                    name: i.itemName,
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    total: Number(i.lineTotal),
                    modifiers: (i.modifiers || []).map((m: any) => m.name)
                })),
                subtotal: Number(o.subtotal),
                discount: Number(o.discount || 0),
                total: Number(o.total),
                serviceFee: Number(o.total) * 0.10
            });
        } catch (e) {
            console.error(e);
            alert('Error al imprimir');
        } finally {
            setPrintingId(null);
        }
    };

    const openVoidModal = (sale: any) => {
        if (!canVoid) return;
        if (sale.status === 'CANCELLED') {
            alert('Esta orden ya está anulada');
            return;
        }
        setVoidModalSale(sale);
        setVoidReason('');
    };

    const closeVoidModal = () => {
        setVoidModalSale(null);
        setVoidReason('');
        setVoidPin('');
    };

    const handleVoidConfirm = async () => {
        if (!voidModalSale || !voidReason.trim() || !voidPin.trim()) return;
        setVoidingId(voidModalSale.id);
        try {
            const result = await voidSalesOrderAction(voidModalSale.id, voidReason.trim(), voidPin.trim());
            if (result.success) {
                closeVoidModal();
                await loadData();
            } else {
                alert(result.message || 'Error al anular');
            }
        } finally {
            setVoidingId(null);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-white">Cargando historial...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto text-white">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Historial de Ventas
                    </h1>
                    <p className="text-gray-400">Registro de transacciones y cierres · {filteredSales.length} de {sales.length} órdenes</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400 font-medium">📅 Fecha:</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                        />
                        {dateFilter && (
                            <button onClick={() => setDateFilter('')} className="text-gray-400 hover:text-white text-xs bg-gray-700 px-2 py-2 rounded-lg">
                                ✕ Todas
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleExportExcel}
                        disabled={!sales.length}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 flex items-center gap-2"
                    >
                        📊 EXPORTAR EXCEL
                    </button>
                    <button
                        onClick={handleGenerateZReport}
                        className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-500/20 flex items-center gap-2"
                    >
                        🖨️ REPORTE "Z" (CIERRE)
                    </button>
                </div>
            </div>


            {/* Tabla de Ventas */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900/50 text-gray-400 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Orden #</th>
                            <th className="p-4">Fecha</th>
                            <th className="p-4">Hora</th>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Método</th>
                            <th className="p-4 text-right">Total Factura</th>
                            <th className="p-4 text-right">Cobrado</th>
                            <th className="p-4 text-center">10% Serv.</th>
                            <th className="p-4">Descuento / Auth</th>
                            <th className="p-4 text-center">Ítems</th>
                            {(canPrint || canVoid) && <th className="p-4 text-center">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 font-mono text-sm">
                        {filteredSales.map(sale => (
                            <React.Fragment key={sale.id}>
                                {(() => {
                                    const amountPaid = getAmountPaid(sale);
                                    const extraTip = getExtraTipTotal(sale);
                                    const serviceInfo = getServiceChargeInfo(sale);
                                    // Pick Up / Delivery: propina en campo `change`; Sport Bar: tipAmount en splits
                                    const tip = extraTip > 0.005
                                        ? extraTip
                                        : Math.max(0, amountPaid - Number(sale.total));
                                    const splits = parseSplitsFromNotes(sale.notes);
                                    const isSportBar = sale.sourceChannel === 'POS_SPORTBAR' || !!sale.openTabId;
                                    return (
                                    <>
                                    <tr
                                        className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                                        onClick={() => setExpandedOrder(expandedOrder === sale.id ? null : sale.id)}
                                    >
                                        <td className="p-4">
                                            <div className="font-bold text-blue-300">{sale.orderNumber}</div>
                                            {isSportBar && sale.openTab?.tabCode && (
                                                <div className="text-[10px] text-slate-500">{sale.openTab.tabCode}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-300 text-xs">
                                            {sale.createdAt ? formatSaleDate(sale.createdAt) : '-'}
                                        </td>
                                        <td className="p-4 text-gray-400">
                                            {sale.createdAt ? formatSaleTime(sale.createdAt) : '-'}
                                        </td>
                                        <td className="p-4 font-sans text-gray-300 truncate max-w-[150px]">
                                            {sale.customerName || 'Cliente General'}
                                        </td>
                                        <td className="p-4">
                                            {getPaymentBadge(sale.paymentMethod)}
                                            {splits && (
                                                <div className="mt-1 space-y-0.5">
                                                    {Object.entries(splits).map(([m, amt]) => (
                                                        <div key={m} className="text-[10px] text-gray-400">
                                                            {PAYMENT_ICONS[m] || ''} {getPaymentLabel(m)}: ${(amt as number).toFixed(2)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-bold text-white text-base">
                                            {formatMoney(Number(sale.total))}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-emerald-300">{formatMoney(amountPaid)}</div>
                                            {tip > 0.005 && (
                                                <div className="text-[10px] text-amber-400" title="Propina adicional (vuelto)">
                                                    +{formatMoney(tip)} propina{extraTip > 0.005 ? ' extra' : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {isSportBar ? (
                                                serviceInfo.charged
                                                    ? <span className="text-green-400 text-xs font-bold" title={`+$${serviceInfo.amount.toFixed(2)}`}>✓ Sí</span>
                                                    : <span className="text-red-400 text-xs font-bold">✗ No</span>
                                            ) : (
                                                <span className="text-gray-600 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 font-sans">
                                            {sale.discount > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {sale.discountType === 'DIVISAS_33' && (
                                                        <span className="text-blue-400 text-xs">📉 Divisas (-{formatMoney(sale.discount)})</span>
                                                    )}
                                                    {sale.discountType === 'CORTESIA_100' && (
                                                        <span className="text-purple-400 text-xs font-bold">🎁 CORTESÍA</span>
                                                    )}
                                                    {(sale.discountType === 'CORTESIA_PERCENT') && (
                                                        <span className="text-purple-400 text-xs">🎁 Cortesía parcial (-{formatMoney(sale.discount)})</span>
                                                    )}
                                                    {sale.authorizedById && (
                                                        <span className="text-green-500 text-[10px] bg-green-900/30 px-1 rounded w-fit">
                                                            Auth: {sale.authorizedBy?.firstName}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : <span className="text-gray-600">-</span>}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-gray-400 text-xs">
                                                {sale.items?.length || 0} {expandedOrder === sale.id ? '▲' : '▼'}
                                            </span>
                                        </td>
                                        {(canPrint || canVoid) && (
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {canPrint && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePrintReceipt(sale); }}
                                                            disabled={printingId === sale.id}
                                                            className="text-white font-medium bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                                                        >
                                                            {printingId === sale.id ? '...' : '🖨️ Imprimir'}
                                                        </button>
                                                    )}
                                                    {canVoid && sale.status !== 'CANCELLED' && (
                                                        <button
                                                            type="button"
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); openVoidModal(sale); }}
                                                            disabled={voidingId === sale.id}
                                                            className="text-red-300 font-medium bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
                                                        >
                                                            {voidingId === sale.id ? '...' : '🚫 Anular'}
                                                        </button>
                                                    )}
                                                    {canVoid && sale.status === 'CANCELLED' && (
                                                        <span className="text-red-500 text-xs font-bold px-2">ANULADA</span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                    {expandedOrder === sale.id && (
                                        <tr className="bg-gray-900/60">
                                            <td colSpan={(canPrint || canVoid) ? 11 : 10} className="px-8 py-3">
                                                {sale.status === 'CANCELLED' && (
                                                    <div className="mb-4 rounded-lg border border-red-800/60 bg-red-900/20 px-4 py-3">
                                                        <p className="text-sm font-bold text-red-400">🚫 Venta anulada</p>
                                                        {sale.voidReason && (
                                                            <p className="mt-1 text-sm text-red-200"><span className="text-red-400">Justificación:</span> {sale.voidReason}</p>
                                                        )}
                                                        {sale.voidedBy && (
                                                            <p className="mt-1 text-xs text-gray-400">
                                                                Anulada por: {sale.voidedBy.firstName} {sale.voidedBy.lastName}
                                                                {sale.voidedAt && <> · {new Date(sale.voidedAt).toLocaleString('es-VE')}</>}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {sale.openTab?.notes && sale.openTab.notes.includes('[ELIMINADO:') && (
                                                    <div className="mb-3 rounded border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                                                        <span className="font-bold text-amber-400">📝 Notas de cuenta (ítems eliminados con justificación):</span>
                                                        <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-[11px]">{sale.openTab.notes}</pre>
                                                    </div>
                                                )}
                                                {sale.items?.length > 0 && (
                                                <table className="w-full text-xs font-sans mb-3">
                                                    <thead>
                                                        <tr className="text-gray-500 uppercase">
                                                            <th className="text-left pb-1">Producto</th>
                                                            <th className="text-center pb-1">Cant.</th>
                                                            <th className="text-right pb-1">P. Unit.</th>
                                                            <th className="text-right pb-1">Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sale.items.map((item: any, i: number) => (
                                                            <tr key={i} className="border-t border-gray-800">
                                                                <td className="py-1 text-gray-300">{item.itemName}</td>
                                                                <td className="py-1 text-center text-gray-400">×{item.quantity}</td>
                                                                <td className="py-1 text-right text-gray-400">{formatMoney(item.unitPrice)}</td>
                                                                <td className="py-1 text-right text-white font-bold">{formatMoney(item.lineTotal)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                )}
                                                {/* Resumen de cobro: antifraude */}
                                                <div className="flex gap-4 flex-wrap text-xs border-t border-gray-800 pt-2">
                                                    <div className="flex gap-1 items-center text-gray-400">
                                                        <span>Productos:</span>
                                                        <span className="font-bold text-white">{formatMoney(Number(sale.subtotal))}</span>
                                                    </div>
                                                    {Number(sale.discount) > 0 && (
                                                        <div className="flex gap-1 items-center text-amber-400">
                                                            <span>Desc.:</span>
                                                            <span className="font-bold">-{formatMoney(Number(sale.discount))}</span>
                                                        </div>
                                                    )}
                                                    {serviceInfo.charged && (
                                                        <div className="flex gap-1 items-center text-green-400">
                                                            <span>10% Servicio:</span>
                                                            <span className="font-bold">+{formatMoney(serviceInfo.amount)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-1 items-center text-white">
                                                        <span>Total factura:</span>
                                                        <span className="font-black">{formatMoney(Number(sale.total))}</span>
                                                    </div>
                                                    <div className="flex gap-1 items-center text-emerald-300">
                                                        <span>Cobrado:</span>
                                                        <span className="font-black">{formatMoney(amountPaid)}</span>
                                                    </div>
                                                    {tip > 0.005 && (
                                                        <div className="flex gap-1 items-center text-amber-400">
                                                            <span>{extraTip > 0.005 ? 'Propina adicional (vuelto):' : 'Propina/excedente:'}</span>
                                                            <span className="font-bold">+{formatMoney(tip)}</span>
                                                        </div>
                                                    )}
                                                    {/* Desglose Sport Bar */}
                                                    {sale.openTab?.paymentSplits?.length > 0 && (
                                                        <div className="w-full mt-1 space-y-0.5">
                                                            <span className="text-gray-500 uppercase text-[10px]">Desglose de pagos:</span>
                                                            {sale.openTab.paymentSplits.map((p: any, idx: number) => (
                                                                <div key={idx} className="flex gap-2 text-[11px] text-gray-300 pl-2">
                                                                    <span>{p.splitLabel}</span>
                                                                    <span className="text-emerald-400 font-bold">${Number(p.paidAmount).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    </>
                                    );
                                })()}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Reporte Z */}
            {showZReport && zReport && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white text-black rounded-lg w-full max-w-sm p-8 font-mono shadow-2xl relative">
                        <button onClick={() => setShowZReport(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-2xl font-bold">×</button>

                        <div className="text-center mb-6 border-b-2 border-dashed border-black pb-4">
                            <h2 className="text-2xl font-black">REPORTE Z</h2>
                            <p className="text-sm">TABLE PONG</p>
                            <p className="text-sm">{new Date().toLocaleString()}</p>
                            <p className="text-sm mt-1 font-bold">CIERRE DE CAJA DIARIO</p>
                        </div>

                        <div className="space-y-1 mb-4 border-b-2 border-dashed border-black pb-4">
                            <div className="flex justify-between">
                                <span>VENTAS BRUTAS</span>
                                <span>{formatMoney(zReport.grossTotal)}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                                <span>(-) DESCUENTOS</span>
                                <span>-{formatMoney(zReport.totalDiscounts)}</span>
                            </div>
                            {zReport.discountBreakdown.divisas > 0 && (
                                <div className="flex justify-between text-xs text-gray-500 pl-4">
                                    <span>Divisas (33%)</span>
                                    <span>-{formatMoney(zReport.discountBreakdown.divisas)}</span>
                                </div>
                            )}
                            {zReport.discountBreakdown.cortesias > 0 && (
                                <div className="flex justify-between text-xs text-gray-500 pl-4">
                                    <span>Cortesías (100%)</span>
                                    <span>-{formatMoney(zReport.discountBreakdown.cortesias)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-xl mt-2 pt-2 border-t border-gray-300">
                                <span>VENTA NETA</span>
                                <span>{formatMoney(zReport.netTotal)}</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="font-bold underline mb-2">ARQUEO DE CAJA</h3>
                            <div className="flex justify-between">
                                <span>EFECTIVO (CAJA)</span>
                                <span className="font-bold">{formatMoney(zReport.paymentBreakdown.cash)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>PUNTO DE VENTA</span>
                                <span>{formatMoney(zReport.paymentBreakdown.card)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>PAGO MÓVIL</span>
                                <span>{formatMoney(zReport.paymentBreakdown.mobile)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>TRANSFERENCIA</span>
                                <span>{formatMoney(zReport.paymentBreakdown.transfer)}</span>
                            </div>
                        </div>

                        <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-300">
                            <p>Fin del Reporte</p>
                            <p>Pedidos Totales: {zReport.totalOrders}</p>
                        </div>

                        <button onClick={() => window.print()} className="w-full bg-black text-white py-3 rounded mt-6 font-bold hover:bg-gray-800 no-print">
                            IMPRIMIR COMPROBANTE
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Anular Factura */}
            <Dialog open={!!voidModalSale} onOpenChange={(open) => !open && closeVoidModal()}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-red-400">Anular factura</DialogTitle>
                    </DialogHeader>
                    {voidModalSale && (
                        <>
                            <p className="text-slate-300 text-sm">
                                Orden <span className="font-bold text-white">{voidModalSale.orderNumber}</span> · Total {formatMoney(Number(voidModalSale.total))}
                            </p>
                            <label className="block text-sm font-medium text-slate-400 mt-3">Motivo de anulación (obligatorio)</label>
                            <textarea
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="Ej: Error en pedido, cliente canceló..."
                                rows={3}
                                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none"
                                autoFocus
                            />
                            <label className="block text-sm font-medium text-slate-400 mt-3">PIN de autorización (obligatorio)</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={voidPin}
                                onChange={(e) => setVoidPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="4-6 dígitos"
                                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-mono text-lg tracking-widest"
                            />
                        </>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <button
                            type="button"
                            onClick={closeVoidModal}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleVoidConfirm}
                            disabled={!voidReason.trim() || !voidPin.trim() || voidingId === voidModalSale?.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
                        >
                            {voidingId === voidModalSale?.id ? 'Anulando...' : 'Confirmar anulación'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
