'use client';

import { useState, useEffect } from 'react';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { usdToBs } from '@/lib/currency';

interface CurrencyCalculatorProps {
    className?: string;
}

export function CurrencyCalculator({ className }: CurrencyCalculatorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [rate, setRate] = useState<number | null>(null);
    const [usdInput, setUsdInput] = useState('');

    useEffect(() => {
        getExchangeRateValue().then(setRate);
    }, []);

    const usd = parseFloat(usdInput.replace(',', '.')) || 0;
    const bs = rate && usd > 0 ? usdToBs(usd, rate) : 0;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition ${className}`}
                title="Calculadora USD → Bs"
            >
                <span>💱</span>
                <span>USD → Bs</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsOpen(false)}>
                    <div
                        className="rounded-2xl border border-slate-600 bg-slate-900 p-6 w-full max-w-sm shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Calculadora USD → Bs</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-white text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        {rate ? (
                            <>
                                <p className="text-sm text-slate-400 mb-2">
                                    Tasa del día: <span className="font-bold text-emerald-400">1 USD = {rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</span>
                                </p>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-400 mb-1">Monto en USD</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={usdInput}
                                        onChange={(e) => setUsdInput(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-xl font-bold text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div className="rounded-xl bg-emerald-900/30 border border-emerald-500/30 px-4 py-3">
                                    <p className="text-xs text-emerald-300/80 mb-1">Equivalente en Bolívares</p>
                                    <p className="text-2xl font-black text-emerald-300">
                                        {bs > 0 ? bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} Bs
                                    </p>
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-400 text-sm">No hay tasa configurada. Configure en Administración → Tasa de Cambio.</p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
