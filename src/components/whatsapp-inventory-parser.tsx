'use client';

import { useState } from 'react';
import { parseWhatsAppInventoryAction, type ImportPreviewResult } from '@/app/actions/import.actions';
import { cn } from '@/lib/utils';

interface WhatsAppInventoryParserProps {
    onPreviewReady: (preview: ImportPreviewResult) => void;
}

export default function WhatsAppInventoryParser({ onPreviewReady }: WhatsAppInventoryParserProps) {
    const [chatText, setChatText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleParse = async () => {
        if (!chatText.trim()) return;
        setIsParsing(true);
        setError(null);
        try {
            const result = await parseWhatsAppInventoryAction(chatText);
            if (result.success && result.items && result.items.length > 0) {
                onPreviewReady(result);
            } else if (result.items?.length === 0) {
                setError('No se encontraron líneas válidas. Revisa el formato (ej: "2 cerveza", "5 harina kg").');
            } else {
                setError(result.message || 'Error al procesar');
            }
        } catch (e) {
            console.error(e);
            setError('Error inesperado al analizar');
        } finally {
            setIsParsing(false);
        }
    };

    const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const cleaned = text.split('\n').map(line => {
            const stripped = line
                .replace(/^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\]?\s*[-–]?\s*/i, '')
                .replace(/^[^:]+:\s*/, '');
            return stripped;
        }).filter(l => l.trim()).join('\n');
        setChatText(cleaned);
        setError(null);
        e.target.value = '';
    };

    return (
        <div className="rounded-xl border-2 border-dashed border-green-200 bg-green-50/50 p-6 dark:border-green-900/50 dark:bg-green-900/10">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="text-2xl">💬</span> Cargar inventario por WhatsApp
                </h3>
            </div>

            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Pega el chat exportado o el inventario anotado. Formato por línea: <strong>cantidad producto</strong> o <strong>producto cantidad unidad</strong>
            </p>

            <div className="mb-4 rounded-lg border border-green-200 bg-white p-3 dark:border-green-800 dark:bg-gray-800">
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Ejemplos:</p>
                <code className="block text-xs text-gray-700 dark:text-gray-300 whitespace-pre">
{`2 cerveza corona
5 harina kg
10 litros aceite
TP-001 10
harina 5 kg`}
                </code>
            </div>

            <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-green-700 dark:text-green-400">
                    📂 Cargar archivo de chat exportado (.txt)
                </label>
                <input
                    type="file"
                    accept=".txt,.text"
                    onChange={handleFileLoad}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer dark:file:bg-green-900/50 dark:file:text-green-300"
                />
            </div>

            <textarea
                value={chatText}
                onChange={(e) => { setChatText(e.target.value); setError(null); }}
                placeholder="Pega aquí el inventario desde WhatsApp..."
                rows={8}
                className={cn(
                    "w-full rounded-lg border px-4 py-3 text-sm font-mono resize-none",
                    "border-gray-200 bg-gray-50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20",
                    "dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                )}
            />

            {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-4 flex gap-2">
                <button
                    onClick={handleParse}
                    disabled={!chatText.trim() || isParsing}
                    className="flex-1 min-h-[48px] rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isParsing ? '⏳ Analizando...' : '🔍 Analizar e Importar'}
                </button>
                <button
                    onClick={() => { setChatText(''); setError(null); }}
                    className="min-h-[48px] rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                    🗑️ Limpiar
                </button>
            </div>
        </div>
    );
}
