'use client';

import { useState } from 'react';
import { getShiftSummaryForBlindCloseAction, submitBlindCloseDeclarationAction } from '@/app/actions/prebill.actions';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo (USD)',
    ZELLE: 'Zelle',
    CARD: 'Tarjeta',
    MOBILE_PAY: 'Pago Móvil (Bs)',
    TRANSFER: 'Transferencia',
};

const METHOD_ORDER = ['CASH', 'ZELLE', 'CARD', 'MOBILE_PAY', 'TRANSFER'];

export default function CierreCiegoPage() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [step, setStep] = useState<'form' | 'declare' | 'result'>('form');
    const [isLoading, setIsLoading] = useState(false);

    // Server summary (hidden from cashier until they declare)
    const [summary, setSummary] = useState<{
        byMethod: Record<string, { expected: number; transactions: number; label: string }>;
        totalExpected: number;
        cortesias: number;
        divisasTransactions: number;
    } | null>(null);

    // Cashier declaration (what they physically count)
    const [declared, setDeclared] = useState<Record<string, string>>({});
    const [cashierNotes, setCashierNotes] = useState('');

    // Result after submission
    const [result, setResult] = useState<{
        hasDiscrepancy: boolean;
        discrepancies: Record<string, { declared: number; expected: number; diff: number }>;
    } | null>(null);

    const handleLoadSummary = async () => {
        setIsLoading(true);
        const res = await getShiftSummaryForBlindCloseAction(date);
        setIsLoading(false);

        if (!res.success || !res.data) {
            alert(res.message || 'Error al cargar datos');
            return;
        }

        setSummary(res.data);
        // Initialize declared values as empty
        const init: Record<string, string> = {};
        for (const m of METHOD_ORDER) {
            if (res.data.byMethod[m]) init[m] = '';
        }
        setDeclared(init);
        setStep('declare');
    };

    const handleSubmit = async () => {
        if (!summary) return;

        // Validate all fields are filled
        const allFilled = Object.keys(declared).every(k => declared[k] !== '');
        if (!allFilled) {
            alert('Complete todos los campos antes de enviar');
            return;
        }

        const declaredNums: Record<string, number> = {};
        const expectedNums: Record<string, number> = {};
        for (const [k, v] of Object.entries(declared)) {
            declaredNums[k] = parseFloat(v) || 0;
        }
        for (const [k, v] of Object.entries(summary.byMethod)) {
            expectedNums[k] = v.expected;
        }

        setIsLoading(true);
        const res = await submitBlindCloseDeclarationAction({
            date,
            declared: declaredNums,
            expected: expectedNums,
            cashierNotes,
        });
        setIsLoading(false);

        if (res.success && res.hasDiscrepancy !== undefined && res.discrepancies) {
            setResult({ hasDiscrepancy: res.hasDiscrepancy, discrepancies: res.discrepancies });
            setStep('result');
        }
    };

    return (
        <div className="max-w-lg mx-auto space-y-6 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cierre Ciego de Caja</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        La cajera declara lo que tiene. El sistema detecta discrepancias.
                    </p>
                </div>
                <Link href="/dashboard/pos/restaurante" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
                    ← Volver al POS
                </Link>
            </div>

            {/* ── Step 1: Select date ──────────────────────────────────────────── */}
            {step === 'form' && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Fecha del turno</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                        />
                    </div>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
                        <strong>Instrucciones:</strong> Sin ver los totales del sistema, la cajera introduce el efectivo y valores que tiene en caja. Al enviar, el sistema compara y muestra cualquier discrepancia al gerente.
                    </div>
                    <button
                        onClick={handleLoadSummary}
                        disabled={isLoading}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                        {isLoading ? 'Cargando...' : 'Iniciar Cierre Ciego →'}
                    </button>
                </div>
            )}

            {/* ── Step 2: Cashier declares (blind — no expected amounts shown) ── */}
            {step === 'declare' && summary && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Ingresa el monto que tienes físicamente en cada método de pago:
                    </p>

                    {Object.keys(declared).map(method => (
                        <div key={method}>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                                {METHOD_LABELS[method] || method}
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={declared[method]}
                                    onChange={e => setDeclared(prev => ({ ...prev, [method]: e.target.value }))}
                                    placeholder="0.00"
                                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-right text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    ))}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                            Notas (opcional)
                        </label>
                        <textarea
                            value={cashierNotes}
                            onChange={e => setCashierNotes(e.target.value)}
                            rows={2}
                            placeholder="Ej: Hubo un pago en Bs que no cuadra..."
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none focus:border-amber-500 focus:outline-none"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50"
                    >
                        {isLoading ? 'Enviando...' : 'Enviar Declaración →'}
                    </button>
                </div>
            )}

            {/* ── Step 3: Result (manager view) ───────────────────────────────── */}
            {step === 'result' && result && summary && (
                <div className="space-y-4">
                    <div className={`rounded-xl border p-4 ${result.hasDiscrepancy
                        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'}`}>
                        <p className={`text-lg font-black ${result.hasDiscrepancy ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                            {result.hasDiscrepancy ? '⚠️ Se detectaron discrepancias' : '✅ Cuadre perfecto'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Total esperado por sistema: <strong>{formatCurrency(summary.totalExpected)}</strong>
                            {summary.cortesias > 0 && ` · ${summary.cortesias} cortesía(s)`}
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Método</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Sistema</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Declarado</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {Object.entries(result.discrepancies).map(([method, data]) => (
                                    <tr key={method} className={Math.abs(data.diff) > 0.01 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {METHOD_LABELS[method] || method}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                                            {formatCurrency(data.expected)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-semibold">
                                            {formatCurrency(data.declared)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${data.diff > 0.01 ? 'text-green-600 dark:text-green-400' : data.diff < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                                            {data.diff > 0 ? '+' : ''}{formatCurrency(data.diff)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* WA report for discrepancies */}
                    {result.hasDiscrepancy && (
                        <button
                            onClick={() => {
                                const lines = Object.entries(result.discrepancies)
                                    .filter(([, d]) => Math.abs(d.diff) > 0.01)
                                    .map(([m, d]) => `• ${METHOD_LABELS[m] || m}: declarado $${d.declared.toFixed(2)} vs sistema $${d.expected.toFixed(2)} (${d.diff > 0 ? '+' : ''}$${d.diff.toFixed(2)})`);
                                const msg = [
                                    `⚠️ *DISCREPANCIA EN CIERRE DE CAJA*`,
                                    `📅 Fecha: ${date}`,
                                    ``,
                                    `*Diferencias detectadas:*`,
                                    ...lines,
                                    ``,
                                    `Total sistema: *$${summary.totalExpected.toFixed(2)}*`,
                                    cashierNotes ? `📝 Nota cajera: ${cashierNotes}` : null,
                                ].filter(Boolean).join('\n');
                                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                            }}
                            className="w-full py-3 bg-[#25D366] hover:bg-[#22c55e] text-white rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.842L.057 23.999l6.304-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.81 9.81 0 01-5.001-1.37l-.36-.213-3.722.976.994-3.629-.233-.374A9.795 9.795 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                            Enviar alerta a WhatsApp Admin
                        </button>
                    )}

                    <button
                        onClick={() => { setStep('form'); setResult(null); setSummary(null); }}
                        className="w-full py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        Nuevo cierre
                    </button>
                </div>
            )}
        </div>
    );
}
