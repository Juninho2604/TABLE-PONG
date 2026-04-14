'use client';

/**
 * CustomerSelector — Cartera de Clientes Fiscales
 *
 * Identificación primaria: Cédula (V/E), RIF (J/V/G/C/E) o Pasaporte.
 * Diseño compacto para el panel de cobro: un solo botón que abre un modal portal.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    searchCustomersAction,
    createCustomerAction,
    formatDocId,
    DOC_TYPE_DISPLAY,
    type CustomerRecord,
    type DocType,
} from '@/app/actions/customer.actions';

// ─── Opciones de tipo de documento (UI) ──────────────────────────────────────

interface DocOption {
    value: DocType;
    label: string;   // prefix visible (V-, J-, etc.)
    hint: string;    // tooltip / descripción corta
    isRif: boolean;
}

const DOC_OPTIONS: DocOption[] = [
    { value: 'CEDULA_V',  label: 'V-',  hint: 'Cédula venezolano',       isRif: false },
    { value: 'CEDULA_E',  label: 'E-',  hint: 'Cédula extranjero',        isRif: false },
    { value: 'RIF_J',     label: 'J-',  hint: 'RIF empresa (Jurídica)',    isRif: true  },
    { value: 'RIF_G',     label: 'G-',  hint: 'RIF gobierno / ente público', isRif: true },
    { value: 'RIF_C',     label: 'C-',  hint: 'RIF cooperativa',           isRif: true  },
    { value: 'PASAPORTE', label: 'PAS', hint: 'Pasaporte',                 isRif: false },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomerSelectorProps {
    value: CustomerRecord | null;
    onSelect: (customer: CustomerRecord | null) => void;
    /** Etiqueta del botón disparador cuando no hay cliente seleccionado */
    triggerLabel?: string;
    className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

/** Normaliza un número de documento: solo dígitos (para cédula/RIF) o alfanumérico (pasaporte). */
function normalizeDoc(raw: string, docType: DocType): string {
    if (docType === 'PASAPORTE') return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return raw.replace(/\D/g, '');
}

// ─── Subcomponente: tarjeta de cliente en resultados ─────────────────────────

function CustomerCard({
    customer,
    onSelect,
}: {
    customer: CustomerRecord;
    onSelect: () => void;
}) {
    const docLabel = formatDocId(customer.docType, customer.docNumber);
    const initials = customer.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');

    return (
        <button
            type="button"
            onClick={onSelect}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card/60 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 text-left transition-all group"
        >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:border-amber-500/50 transition-colors">
                <span className="text-amber-400 text-xs font-black">{initials || '?'}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">{customer.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {docLabel ? (
                        <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {docLabel}
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground italic">Sin doc. fiscal</span>
                    )}
                    {customer.phone && (
                        <span className="text-[10px] text-muted-foreground truncate">{customer.phone}</span>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold text-emerald-400">{formatCurrency(customer.totalSpent)}</p>
                <p className="text-[10px] text-muted-foreground">{customer.visitCount} vis.</p>
            </div>
        </button>
    );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function CustomerSelector({
    value,
    onSelect,
    triggerLabel = 'Vincular cliente',
    className = '',
}: CustomerSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    // ── Búsqueda ──────────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<CustomerRecord[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // ── Formulario de creación ────────────────────────────────────────────────
    const [mode, setMode] = useState<'search' | 'create'>('search');
    const [newName, setNewName] = useState('');
    const [newDocType, setNewDocType] = useState<DocType>('CEDULA_V');
    const [newDocNumber, setNewDocNumber] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const searchRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Abrir modal ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setMode('search');
            setNewName('');
            setNewDocNumber('');
            setNewPhone('');
            setCreateError('');
            loadResults('');
            setTimeout(() => searchRef.current?.focus(), 80);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // ── Búsqueda con debounce ─────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen || mode !== 'search') return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadResults(search), 280);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search, isOpen, mode]);

    const loadResults = useCallback(async (q: string) => {
        setIsSearching(true);
        const res = await searchCustomersAction(q);
        if (res.success) setResults(res.data ?? []);
        setIsSearching(false);
    }, []);

    // ── Seleccionar ───────────────────────────────────────────────────────────
    function handleSelect(c: CustomerRecord) {
        onSelect(c);
        setIsOpen(false);
    }

    function handleClear(e: React.MouseEvent) {
        e.stopPropagation();
        onSelect(null);
    }

    // ── Iniciar creación (prellenando nombre desde búsqueda) ──────────────────
    function startCreate() {
        setNewName(search.trim());
        setNewDocType('CEDULA_V');
        setNewDocNumber('');
        setNewPhone('');
        setCreateError('');
        setMode('create');
    }

    // ── Crear cliente ─────────────────────────────────────────────────────────
    async function handleCreate() {
        if (!newName.trim()) {
            setCreateError('El nombre es obligatorio');
            return;
        }
        setIsCreating(true);
        setCreateError('');

        const docNumberClean = normalizeDoc(newDocNumber, newDocType);

        const res = await createCustomerAction({
            name:      newName.trim(),
            docType:   docNumberClean ? newDocType : null,
            docNumber: docNumberClean || null,
            phone:     newPhone.trim() || null,
        });

        setIsCreating(false);

        if (res.success && res.data) {
            handleSelect(res.data);
        } else {
            setCreateError(res.message || 'No se pudo crear el cliente');
        }
    }

    // ── Doc number — actualiza restringiendo caracteres ───────────────────────
    function handleDocNumberChange(raw: string) {
        setNewDocNumber(normalizeDoc(raw, newDocType));
    }

    const currentDocOption = DOC_OPTIONS.find((o) => o.value === newDocType) ?? DOC_OPTIONS[0];
    const noResults = !isSearching && results.length === 0;
    const docLabel = value ? formatDocId(value.docType, value.docNumber) : '';

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Trigger ── */}
            <div className={`relative ${className}`}>
                {value ? (
                    /* Cliente seleccionado — chip compacto */
                    <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/40 rounded-xl px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <span className="text-emerald-400 text-[10px] font-black">
                                {value.name.split(' ').map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-emerald-300 truncate leading-tight">{value.name}</p>
                            {docLabel
                                ? <p className="text-[10px] font-mono text-emerald-500/70">{docLabel}</p>
                                : <p className="text-[10px] text-muted-foreground italic">Sin doc. fiscal</p>
                            }
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                            <span className="text-[10px] text-emerald-500/60">{value.visitCount}v</span>
                            <button
                                type="button"
                                onClick={() => setIsOpen(true)}
                                title="Cambiar cliente"
                                className="text-emerald-500/40 hover:text-amber-400 text-xs transition p-0.5 rounded"
                            >✎</button>
                            <button
                                type="button"
                                onClick={handleClear}
                                title="Quitar cliente"
                                className="text-emerald-500/40 hover:text-red-400 text-base leading-none transition"
                            >×</button>
                        </div>
                    </div>
                ) : (
                    /* Sin cliente — botón trigger */
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="w-full flex items-center gap-2 bg-card hover:bg-muted border border-border hover:border-amber-500/50 rounded-xl px-3 py-2 transition group"
                    >
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-amber-500/10 transition-colors">
                            <span className="text-muted-foreground group-hover:text-amber-400 text-xs transition">👤</span>
                        </div>
                        <span className="flex-1 text-left text-xs text-muted-foreground group-hover:text-foreground transition">{triggerLabel}</span>
                        <span className="text-[10px] text-amber-500/60 font-semibold shrink-0">Opcional</span>
                    </button>
                )}
            </div>

            {/* ── Modal portal ── */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-background border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
                        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ── Header ── */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                                    <span className="text-amber-400 text-sm">👤</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground leading-tight">Cartera de Clientes</h3>
                                    <p className="text-[10px] text-muted-foreground">Búsqueda por nombre, cédula, RIF o pasaporte</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xl leading-none transition"
                            >×</button>
                        </div>

                        {/* ── Modo búsqueda ── */}
                        {mode === 'search' && (
                            <div className="flex flex-col flex-1 min-h-0">
                                {/* Search input */}
                                <div className="px-4 pt-3 pb-2 shrink-0">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Nombre, cédula, RIF o teléfono..."
                                            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none transition"
                                        />
                                    </div>
                                </div>

                                {/* Results list */}
                                <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1 min-h-0">
                                    {isSearching && (
                                        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                                            <span className="animate-spin text-amber-500">⟳</span>
                                            <span className="text-xs">Buscando...</span>
                                        </div>
                                    )}

                                    {!isSearching && results.map((c) => (
                                        <CustomerCard key={c.id} customer={c} onSelect={() => handleSelect(c)} />
                                    ))}

                                    {noResults && !search && (
                                        <div className="text-center py-8">
                                            <p className="text-2xl mb-2">👥</p>
                                            <p className="text-xs text-muted-foreground">No hay clientes registrados aún</p>
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">Crea el primero con el botón de abajo</p>
                                        </div>
                                    )}

                                    {noResults && search && (
                                        <div className="text-center py-6">
                                            <p className="text-xl mb-2">🔎</p>
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Sin resultados para <span className="text-foreground font-semibold">&quot;{search}&quot;</span>
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/60">¿Deseas crear este cliente?</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer: crear cliente */}
                                <div className="shrink-0 px-4 pb-4 pt-2 border-t border-border">
                                    <button
                                        type="button"
                                        onClick={startCreate}
                                        className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/60 text-amber-400 hover:text-amber-300 text-xs font-bold transition flex items-center justify-center gap-2"
                                    >
                                        <span className="text-base leading-none">+</span>
                                        {search.trim() ? `Registrar "${search.trim()}"` : 'Registrar nuevo cliente'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Modo creación ── */}
                        {mode === 'create' && (
                            <div className="flex flex-col flex-1 overflow-y-auto">
                                <div className="px-5 py-4 space-y-4">
                                    {/* Nombre */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
                                            Nombre completo <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="Ej: Carlos Rodríguez / Empresa ABC, C.A."
                                            autoFocus
                                            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none transition"
                                        />
                                    </div>

                                    {/* Documento de identidad */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
                                            Documento de identidad <span className="text-muted-foreground/50 font-normal normal-case ml-1">(opcional)</span>
                                        </label>

                                        {/* Tipo de documento — selector pill */}
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {DOC_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    title={opt.hint}
                                                    onClick={() => {
                                                        setNewDocType(opt.value);
                                                        setNewDocNumber('');
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                                        newDocType === opt.value
                                                            ? 'bg-amber-500 border-amber-500 text-black'
                                                            : 'bg-card border-border text-muted-foreground hover:border-amber-500/50 hover:text-foreground'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Input número con prefijo visual */}
                                        <div className="flex items-stretch">
                                            <div className="flex items-center bg-muted/50 border border-border border-r-0 rounded-l-xl px-3 shrink-0">
                                                <span className="text-xs font-bold text-amber-400 font-mono whitespace-nowrap">
                                                    {currentDocOption.label}
                                                </span>
                                            </div>
                                            <input
                                                type={newDocType === 'PASAPORTE' ? 'text' : 'text'}
                                                inputMode={newDocType === 'PASAPORTE' ? 'text' : 'numeric'}
                                                value={newDocNumber}
                                                onChange={(e) => handleDocNumberChange(e.target.value)}
                                                placeholder={
                                                    newDocType === 'PASAPORTE'    ? 'Número de pasaporte' :
                                                    currentDocOption.isRif         ? '123456789' :
                                                    '12345678'
                                                }
                                                className="flex-1 bg-card border border-border rounded-r-xl px-3 py-2.5 text-sm font-mono text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none transition"
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/60 mt-1">{currentDocOption.hint}</p>
                                    </div>

                                    {/* Teléfono (opcional) */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
                                            Teléfono <span className="text-muted-foreground/50 font-normal normal-case ml-1">(opcional)</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={newPhone}
                                            onChange={(e) => setNewPhone(e.target.value)}
                                            placeholder="Ej: 0414-1234567"
                                            className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none transition"
                                        />
                                    </div>

                                    {/* Error */}
                                    {createError && (
                                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                                            <span className="text-red-400 shrink-0">⚠</span>
                                            <p className="text-xs text-red-400">{createError}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="shrink-0 px-5 pb-5 pt-2 border-t border-border flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setMode('search')}
                                        className="flex-1 py-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:bg-muted text-sm font-semibold transition"
                                    >
                                        ← Volver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCreate}
                                        disabled={isCreating || !newName.trim()}
                                        className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-black transition disabled:opacity-40 flex items-center justify-center gap-2"
                                    >
                                        {isCreating ? (
                                            <>
                                                <span className="animate-spin text-base">⟳</span>
                                                Guardando...
                                            </>
                                        ) : (
                                            '✓ Guardar cliente'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
