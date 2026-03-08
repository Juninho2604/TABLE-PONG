'use client';

import { useState } from 'react';
import { setExchangeRateAction } from '@/app/actions/exchange.actions';

const BCV_URL = 'https://www.bcv.org.ve/';

interface CurrentRate {
    rate: number;
    effectiveDate: Date;
    source: string;
    formatted: string;
}

interface HistoryItem {
    id: string;
    rate: number;
    effectiveDate: Date;
    source: string;
    createdAt: Date;
}

interface TasaCambioViewProps {
    currentRate: CurrentRate | null;
    history: HistoryItem[];
    canEdit: boolean;
}

export function TasaCambioView({ currentRate, history, canEdit }: TasaCambioViewProps) {
    const [rate, setRate] = useState(currentRate?.rate?.toString() ?? '433.16');
    const [effectiveDate, setEffectiveDate] = useState(() => {
        if (currentRate?.effectiveDate) {
            const d = new Date(currentRate.effectiveDate);
            return d.toISOString().slice(0, 10);
        }
        return new Date().toISOString().slice(0, 10);
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numRate = parseFloat(rate.replace(',', '.'));
        if (isNaN(numRate) || numRate <= 0) {
            setMessage({ type: 'error', text: 'Ingrese una tasa válida' });
            return;
        }
        setIsSubmitting(true);
        setMessage(null);
        const result = await setExchangeRateAction(numRate, new Date(effectiveDate));
        setIsSubmitting(false);
        if (result.success) {
            setMessage({ type: 'success', text: result.message ?? 'Tasa actualizada' });
            window.location.reload();
        } else {
            setMessage({ type: 'error', text: result.message ?? 'Error' });
        }
    };

    const formatDate = (d: Date) => {
        return new Date(d).toLocaleDateString('es-VE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            {/* Tasa actual */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tasa vigente</h2>
                {currentRate ? (
                    <div className="mt-4">
                        <p className="text-3xl font-bold text-primary">
                            1 USD = {currentRate.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs
                        </p>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Fecha valor: {formatDate(currentRate.effectiveDate)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Fuente: {currentRate.source}
                        </p>
                    </div>
                ) : (
                    <p className="mt-2 text-amber-600 dark:text-amber-400">
                        No hay tasa configurada. Configure una tasa para mostrar precios en Bolívares.
                    </p>
                )}
            </div>

            {/* Formulario (solo OWNER) */}
            {canEdit && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Actualizar tasa</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Consulte la tasa oficial en{' '}
                        <a href={BCV_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            bcv.org.ve
                        </a>
                        {' '}y actualice aquí. Los fines de semana use la tasa del lunes.
                    </p>
                    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bs por 1 USD</label>
                            <input
                                type="text"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                placeholder="433.16"
                                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha valor</label>
                            <input
                                type="date"
                                value={effectiveDate}
                                onChange={(e) => setEffectiveDate(e.target.value)}
                                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Guardando...' : 'Guardar tasa'}
                        </button>
                    </form>
                    {message && (
                        <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {message.text}
                        </p>
                    )}
                </div>
            )}

            {/* Historial */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historial</h2>
                {history.length > 0 ? (
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-600">
                                    <th className="pb-2 text-left font-medium text-gray-700 dark:text-gray-300">Fecha valor</th>
                                    <th className="pb-2 text-right font-medium text-gray-700 dark:text-gray-300">Tasa (Bs/USD)</th>
                                    <th className="pb-2 text-left font-medium text-gray-700 dark:text-gray-300">Registrado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id} className="border-b border-gray-100 dark:border-gray-700">
                                        <td className="py-2 text-gray-900 dark:text-white">{formatDate(h.effectiveDate)}</td>
                                        <td className="py-2 text-right font-mono">{h.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-2 text-gray-500 dark:text-gray-400">
                                            {new Date(h.createdAt).toLocaleString('es-VE')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Sin historial de tasas.</p>
                )}
            </div>
        </div>
    );
}
