'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    searchCustomersAction,
    createCustomerAction,
    type CustomerRecord,
} from '@/app/actions/customer.actions';

interface CustomerSelectorProps {
    /** Cliente actualmente seleccionado */
    value: CustomerRecord | null;
    /** Nombre libre escrito (si no hay customer de la BD) */
    nameInput: string;
    onNameChange: (name: string) => void;
    onSelect: (customer: CustomerRecord | null) => void;
    /** Placeholder para el input de nombre */
    placeholder?: string;
    className?: string;
}

export function CustomerSelector({
    value,
    nameInput,
    onNameChange,
    onSelect,
    placeholder = 'Nombre del cliente...',
    className = '',
}: CustomerSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<CustomerRecord[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cargar frecuentes al abrir
    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setShowCreateForm(false);
            setNewPhone('');
            loadResults('');
            setTimeout(() => searchRef.current?.focus(), 80);
        }
    }, [isOpen]);

    // Búsqueda con debounce
    useEffect(() => {
        if (!isOpen) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadResults(search), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search, isOpen]);

    async function loadResults(q: string) {
        setIsSearching(true);
        const res = await searchCustomersAction(q);
        if (res.success) setResults(res.data ?? []);
        setIsSearching(false);
    }

    function handleSelect(c: CustomerRecord) {
        onSelect(c);
        onNameChange(c.name);
        setIsOpen(false);
    }

    function handleClear() {
        onSelect(null);
        onNameChange('');
    }

    async function handleCreate() {
        if (!search.trim()) return;
        setIsCreating(true);
        const res = await createCustomerAction({ name: search.trim(), phone: newPhone.trim() || undefined });
        setIsCreating(false);
        if (res.success && res.data) {
            handleSelect(res.data);
        } else {
            alert(res.message || 'No se pudo crear el cliente');
        }
    }

    const noResults = !isSearching && results.length === 0;

    return (
        <>
            {/* ── Trigger / Display ── */}
            <div className={`relative flex items-center gap-1 ${className}`}>
                {value ? (
                    <div className="flex-1 flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-3 py-2">
                        <span className="text-xs">👤</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-emerald-300 truncate">{value.name}</p>
                            {value.phone && <p className="text-[10px] text-emerald-400/60">{value.phone}</p>}
                        </div>
                        <span className="text-[9px] text-emerald-500/60 shrink-0">{value.visitCount}v</span>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-emerald-400/50 hover:text-red-400 text-base leading-none ml-1 shrink-0"
                            title="Quitar cliente"
                        >×</button>
                    </div>
                ) : (
                    <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                )}
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    title="Buscar cliente habitual"
                    className="shrink-0 bg-card border border-border hover:border-amber-500 rounded-lg px-2 py-2 text-muted-foreground hover:text-amber-400 transition text-sm"
                >
                    🔍
                </button>
            </div>

            {/* ── Modal ── */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <h3 className="text-sm font-bold text-foreground">Cartera de Clientes</h3>
                            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                        </div>

                        {/* Search */}
                        <div className="px-3 pt-3 pb-2">
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Nombre o teléfono..."
                                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none"
                            />
                        </div>

                        {/* Results */}
                        <div className="max-h-60 overflow-y-auto px-3 pb-2 space-y-1">
                            {isSearching && (
                                <p className="text-center text-xs text-muted-foreground py-4">Buscando...</p>
                            )}
                            {!isSearching && results.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleSelect(c)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-card hover:bg-muted text-left transition group"
                                >
                                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-amber-400 text-xs font-bold">{c.name[0].toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{c.phone || 'Sin teléfono'}</p>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{c.visitCount} vis.</span>
                                </button>
                            ))}
                            {noResults && !showCreateForm && (
                                <div className="text-center py-3">
                                    <p className="text-xs text-muted-foreground mb-2">
                                        {search ? `No se encontró "${search}"` : 'No hay clientes aún'}
                                    </p>
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateForm(true)}
                                            className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                                        >
                                            + Crear "{search}"
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Create form */}
                        {showCreateForm && (
                            <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Nuevo cliente</p>
                                <p className="text-xs text-foreground font-medium">{search}</p>
                                <input
                                    type="tel"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    placeholder="Teléfono (opcional)"
                                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-amber-500 focus:outline-none"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateForm(false)}
                                        className="flex-1 py-1.5 text-xs rounded-lg bg-card border border-border text-muted-foreground hover:bg-muted"
                                    >Cancelar</button>
                                    <button
                                        type="button"
                                        onClick={handleCreate}
                                        disabled={isCreating}
                                        className="flex-1 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50"
                                    >{isCreating ? '...' : 'Guardar'}</button>
                                </div>
                            </div>
                        )}

                        {/* Footer: crear desde cualquier búsqueda con resultados */}
                        {!showCreateForm && results.length > 0 && search && (
                            <div className="border-t border-border px-3 py-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(true)}
                                    className="w-full text-xs text-amber-400 hover:text-amber-300 font-semibold py-1"
                                >
                                    + Crear nuevo cliente "{search}"
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
