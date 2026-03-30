'use client';

import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createSubTabAction, assignItemsToSubTabAction } from '@/app/actions/subtab.actions';

interface ItemSummary {
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}
interface OrderSummary {
    id: string;
    items: ItemSummary[];
}
interface SubTabInfo {
    id: string;
    tabCode: string;
    customerLabel?: string;
    splitIndex?: number | null;
}

interface SplitTabModalProps {
    parentTabId: string;
    parentTabCode: string;
    orders: OrderSummary[];
    existingSubTabs: SubTabInfo[];
    onClose: () => void;
    onDone: () => void;
}

export function SplitTabModal({
    parentTabId,
    parentTabCode,
    orders,
    existingSubTabs,
    onClose,
    onDone,
}: SplitTabModalProps) {
    const [destination, setDestination] = useState<'new' | string>('new');
    const [customerLabel, setCustomerLabel] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Flatten all items across all orders
    const allItems = useMemo(() => orders.flatMap(o => o.items), [orders]);

    const totalSelected = useMemo(() =>
        Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
            const item = allItems.find(i => i.id === itemId);
            if (!item || qty <= 0) return sum;
            return sum + (item.lineTotal / item.quantity) * qty;
        }, 0),
    [selectedItems, allItems]);

    const hasSelection = Object.values(selectedItems).some(q => q > 0);
    const canSubmit = hasSelection && !isSubmitting && (destination !== 'new' || customerLabel.trim().length > 0);

    function toggleItem(itemId: string, maxQty: number) {
        setSelectedItems(prev => {
            if ((prev[itemId] || 0) > 0) {
                const next = { ...prev };
                delete next[itemId];
                return next;
            }
            return { ...prev, [itemId]: maxQty };
        });
    }

    function setItemQty(itemId: string, qty: number, maxQty: number) {
        if (qty <= 0) {
            setSelectedItems(prev => { const n = { ...prev }; delete n[itemId]; return n; });
        } else {
            setSelectedItems(prev => ({ ...prev, [itemId]: Math.min(qty, maxQty) }));
        }
    }

    async function handleSubmit() {
        if (!canSubmit) return;
        setIsSubmitting(true);

        try {
            let subTabId: string;

            if (destination === 'new') {
                const res = await createSubTabAction({
                    parentTabId,
                    customerLabel: customerLabel.trim(),
                    customerPhone: customerPhone.trim() || undefined,
                });
                if (!res.success || !res.data) {
                    toast.error(res.message || 'Error creando subcuenta');
                    setIsSubmitting(false);
                    return;
                }
                subTabId = res.data.id;
            } else {
                subTabId = destination;
            }

            const moveItems = Object.entries(selectedItems)
                .filter(([, qty]) => qty > 0)
                .map(([itemId, quantity]) => ({ itemId, quantity }));

            const moveRes = await assignItemsToSubTabAction({ parentTabId, subTabId, items: moveItems });
            if (!moveRes.success) {
                toast.error(moveRes.message || 'Error moviendo ítems');
                setIsSubmitting(false);
                return;
            }

            toast.success(`Subcuenta creada · $${moveRes.movedAmount?.toFixed(2)}`);
            onDone();
        } catch {
            toast.error('Error inesperado');
            setIsSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 p-3">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <div>
                        <div className="font-black text-base">Dividir Cuenta</div>
                        <div className="text-xs text-muted-foreground">{parentTabCode}</div>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl w-8 h-8 flex items-center justify-center">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* Destination selector (shown only if existing subtabs exist) */}
                    {existingSubTabs.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Destino</p>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setDestination('new')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                        destination === 'new'
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-secondary text-foreground/70 hover:bg-muted'
                                    }`}
                                >
                                    + Nueva subcuenta
                                </button>
                                {existingSubTabs.map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => setDestination(st.id)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                            destination === st.id
                                                ? 'bg-amber-500 text-black'
                                                : 'bg-secondary text-foreground/70 hover:bg-muted'
                                        }`}
                                    >
                                        Sub {st.splitIndex ?? '?'}: {st.customerLabel || st.tabCode}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Customer info — only for new subtab */}
                    {destination === 'new' && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Cliente *</p>
                            <input
                                type="text"
                                placeholder="Nombre (obligatorio)"
                                value={customerLabel}
                                onChange={e => setCustomerLabel(e.target.value)}
                                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                                autoFocus
                            />
                            <input
                                type="tel"
                                placeholder="Teléfono (opcional)"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Items to move */}
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Ítems a mover</p>
                        {allItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">No hay ítems disponibles en la cuenta</p>
                        ) : (
                            <div className="space-y-1.5">
                                {allItems.map(item => {
                                    const selected = selectedItems[item.id] || 0;
                                    const unitEffective = item.lineTotal / item.quantity;
                                    const isChecked = selected > 0;

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleItem(item.id, item.quantity)}
                                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none ${
                                                isChecked
                                                    ? 'border-amber-500 bg-amber-500/10'
                                                    : 'border-border bg-secondary hover:border-amber-500/40'
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                                                isChecked ? 'bg-amber-500 border-amber-500' : 'border-muted-foreground'
                                            }`}>
                                                {isChecked && <span className="text-black text-[9px] font-black">✓</span>}
                                            </div>

                                            {/* Item info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold truncate">{item.itemName}</div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    ${unitEffective.toFixed(2)} c/u · disponible: {item.quantity}
                                                </div>
                                            </div>

                                            {/* Quantity controls (only when selected and qty > 1) */}
                                            {isChecked && item.quantity > 1 && (
                                                <div
                                                    className="flex items-center gap-1"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={() => setItemQty(item.id, selected - 1, item.quantity)}
                                                        className="w-6 h-6 bg-card rounded-full text-sm font-bold border border-border hover:bg-muted flex items-center justify-center"
                                                    >−</button>
                                                    <span className="text-xs font-bold w-5 text-center">{selected}</span>
                                                    <button
                                                        onClick={() => setItemQty(item.id, selected + 1, item.quantity)}
                                                        className="w-6 h-6 bg-card rounded-full text-sm font-bold border border-border hover:bg-muted flex items-center justify-center"
                                                    >+</button>
                                                </div>
                                            )}

                                            {/* Line total */}
                                            <div className="text-xs font-bold text-amber-400 ml-1 flex-shrink-0">
                                                ${(unitEffective * (isChecked ? selected : item.quantity)).toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border space-y-2 shrink-0">
                    {hasSelection && (
                        <div className="text-center text-xs text-muted-foreground">
                            Total a mover:{' '}
                            <span className="text-amber-400 font-black">${totalSelected.toFixed(2)}</span>
                        </div>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-xl font-black text-sm disabled:opacity-40 transition"
                    >
                        {isSubmitting
                            ? 'Procesando...'
                            : destination === 'new'
                            ? 'Crear Subcuenta →'
                            : 'Mover a Subcuenta →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
