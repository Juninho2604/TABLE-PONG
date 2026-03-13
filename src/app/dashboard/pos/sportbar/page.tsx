'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    addItemsToOpenTabAction,
    closeOpenTabAction,
    getMenuForPOSAction,
    getSportBarLayoutAction,
    openTabAction,
    registerOpenTabPaymentAction,
    type CartItem,
} from '@/app/actions/pos.actions';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { printKitchenCommand } from '@/lib/print-command';
import { PriceDisplay } from '@/components/pos/PriceDisplay';
import { CurrencyCalculator } from '@/components/pos/CurrencyCalculator';

interface ModifierOption {
    id: string;
    name: string;
    priceAdjustment: number;
    isAvailable: boolean;
}

interface ModifierGroup {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    modifiers: ModifierOption[];
}

interface MenuItem {
    id: string;
    categoryId: string;
    sku: string;
    name: string;
    price: number;
    modifierGroups: {
        modifierGroup: ModifierGroup;
    }[];
}

interface SelectedModifier {
    groupId: string;
    groupName: string;
    id: string;
    name: string;
    priceAdjustment: number;
    quantity: number;
}

interface PaymentSplit {
    id: string;
    splitLabel: string;
    paymentMethod?: string;
    total: number;
    paidAmount: number;
    paidAt?: string;
}

interface SalesOrderSummary {
    id: string;
    orderNumber: string;
    total: number;
    kitchenStatus: string;
    createdAt: string;
    items: {
        id: string;
        itemName: string;
        quantity: number;
        lineTotal: number;
    }[];
}

interface OpenTabSummary {
    id: string;
    tabCode: string;
    customerLabel?: string;
    guestCount: number;
    status: string;
    runningTotal: number;
    balanceDue: number;
    orders: SalesOrderSummary[];
    paymentSplits: PaymentSplit[];
}

interface TableOrStationSummary {
    id: string;
    name: string;
    code: string;
    stationType: string;
    capacity: number;
    currentStatus: string;
    openTabs: OpenTabSummary[];
}

interface ServiceZoneSummary {
    id: string;
    name: string;
    zoneType: string;
    tablesOrStations: TableOrStationSummary[];
}

interface SportBarLayout {
    id: string;
    name: string;
    serviceZones: ServiceZoneSummary[];
}

export default function POSSportBarPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [layout, setLayout] = useState<SportBarLayout | null>(null);
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [selectedTableId, setSelectedTableId] = useState('');
    const [selectedTabId, setSelectedTabId] = useState('');
    const [customerLabel, setCustomerLabel] = useState('');
    const [guestCount, setGuestCount] = useState(2);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY'>('CASH');
    const [amountReceived, setAmountReceived] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
    const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemNotes, setItemNotes] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [menuResult, layoutResult] = await Promise.all([
                getMenuForPOSAction(),
                getSportBarLayoutAction()
            ]);

            if (menuResult.success && menuResult.data) {
                setCategories(menuResult.data);
                setSelectedCategory(prev => prev || menuResult.data[0]?.id || '');
            }

            if (layoutResult.success && layoutResult.data) {
                const nextLayout = layoutResult.data as SportBarLayout;
                setLayout(nextLayout);
                setSelectedZoneId(prev => prev || nextLayout.serviceZones[0]?.id || '');
            }

            const rate = await getExchangeRateValue();
            setExchangeRate(rate);
        } catch (error) {
            console.error('Error loading sport bar data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!selectedCategory || categories.length === 0) return;
        const category = categories.find(cat => cat.id === selectedCategory);
        setMenuItems(category?.items || []);
    }, [selectedCategory, categories]);

    const selectedZone = useMemo(
        () => layout?.serviceZones.find(zone => zone.id === selectedZoneId) || null,
        [layout, selectedZoneId]
    );

    useEffect(() => {
        if (!selectedZone) return;
        if (!selectedTableId || !selectedZone.tablesOrStations.some(table => table.id === selectedTableId)) {
            setSelectedTableId(selectedZone.tablesOrStations[0]?.id || '');
        }
    }, [selectedZone, selectedTableId]);

    const selectedTable = useMemo(
        () => selectedZone?.tablesOrStations.find(table => table.id === selectedTableId) || null,
        [selectedZone, selectedTableId]
    );

    const activeTab = useMemo(() => {
        if (!selectedTable) return null;
        if (selectedTabId) {
            return selectedTable.openTabs.find(tab => tab.id === selectedTabId) || selectedTable.openTabs[0] || null;
        }
        return selectedTable.openTabs[0] || null;
    }, [selectedTable, selectedTabId]);

    useEffect(() => {
        setSelectedTabId(activeTab?.id || '');
        if (activeTab?.customerLabel) {
            setCustomerLabel(activeTab.customerLabel);
        } else if (selectedTable) {
            setCustomerLabel(selectedTable.name);
        }
    }, [activeTab, selectedTable]);

    const getCategoryIcon = (name: string) => {
        if (name.includes('Cocktail') || name.includes('Licor')) return '🍸';
        if (name.includes('Bebida')) return '🥤';
        if (name.includes('Combo')) return '🍱';
        if (name.includes('Postre')) return '🍨';
        if (name.includes('Burger') || name.includes('Plato')) return '🍔';
        return '🍽️';
    };

    const handleAddToCart = (item: MenuItem) => {
        setSelectedItemForModifier(item);
        setCurrentModifiers([]);
        setItemQuantity(1);
        setItemNotes('');
        setShowModifierModal(true);
    };

    const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
        const currentInGroup = currentModifiers.filter(m => m.groupId === group.id);
        const totalSelectedInGroup = currentInGroup.reduce((sum, m) => sum + m.quantity, 0);
        const existingMod = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
        const currentQty = existingMod ? existingMod.quantity : 0;

        if (change > 0) {
            if (group.maxSelections > 1 && totalSelectedInGroup >= group.maxSelections) return;
            if (group.maxSelections === 1) {
                if (totalSelectedInGroup >= 1 && existingMod) return;
                if (totalSelectedInGroup >= 1 && !existingMod) {
                    const others = currentModifiers.filter(m => m.groupId !== group.id);
                    setCurrentModifiers([...others, {
                        groupId: group.id,
                        groupName: group.name,
                        id: modifier.id,
                        name: modifier.name,
                        priceAdjustment: modifier.priceAdjustment,
                        quantity: 1
                    }]);
                    return;
                }
            }
        }

        const newQty = currentQty + change;
        if (newQty < 0) return;

        let newModifiers = [...currentModifiers];
        if (existingMod) {
            if (newQty === 0) {
                newModifiers = newModifiers.filter(m => !(m.id === modifier.id && m.groupId === group.id));
            } else {
                newModifiers = newModifiers.map(m => (
                    m.id === modifier.id && m.groupId === group.id
                        ? { ...m, quantity: newQty }
                        : m
                ));
            }
        } else if (newQty > 0) {
            newModifiers.push({
                groupId: group.id,
                groupName: group.name,
                id: modifier.id,
                name: modifier.name,
                priceAdjustment: modifier.priceAdjustment,
                quantity: newQty
            });
        }

        setCurrentModifiers(newModifiers);
    };

    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        const count = currentModifiers
            .filter(m => m.groupId === group.id)
            .reduce((sum, m) => sum + m.quantity, 0);
        return count >= group.minSelections;
    };

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;

        const allGroupsValid = selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup));
        if (!allGroupsValid) return;

        const modifierTotal = currentModifiers.reduce((sum, modifier) => sum + (modifier.priceAdjustment * modifier.quantity), 0);
        const lineTotal = (selectedItemForModifier.price + modifierTotal) * itemQuantity;
        const explodedModifiers = currentModifiers.flatMap(modifier => (
            Array(modifier.quantity).fill({
                modifierId: modifier.id,
                name: modifier.name,
                priceAdjustment: modifier.priceAdjustment
            })
        ));

        const newItem: CartItem = {
            menuItemId: selectedItemForModifier.id,
            name: selectedItemForModifier.name,
            quantity: itemQuantity,
            unitPrice: selectedItemForModifier.price,
            modifiers: explodedModifiers,
            notes: itemNotes || undefined,
            lineTotal,
        };

        setCart(prev => [...prev, newItem]);
        setShowModifierModal(false);
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, currentIndex) => currentIndex !== index));
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const paidAmount = parseFloat(amountReceived) || 0;

    const handleOpenTab = async () => {
        if (!selectedTable) return;
        setIsProcessing(true);
        try {
            const result = await openTabAction({
                tableOrStationId: selectedTable.id,
                customerLabel: customerLabel || selectedTable.name,
                guestCount,
            });

            if (!result.success) {
                alert(result.message);
                return;
            }

            await loadData();
            setSelectedTabId(result.data.id);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendToTab = async () => {
        if (!activeTab || cart.length === 0) return;

        setIsProcessing(true);
        try {
            const result = await addItemsToOpenTabAction({
                openTabId: activeTab.id,
                items: cart,
            });

            if (!result.success) {
                alert(result.message);
                return;
            }

            if (result.data?.kitchenStatus === 'SENT') {
                printKitchenCommand({
                    orderNumber: result.data.orderNumber,
                    orderType: 'RESTAURANT',
                    customerName: activeTab.customerLabel || selectedTable?.name,
                    items: cart.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        modifiers: item.modifiers.map(modifier => modifier.name),
                        notes: item.notes,
                    })),
                    createdAt: new Date(),
                });
            }

            setCart([]);
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRegisterPayment = async () => {
        if (!activeTab || paidAmount <= 0) return;

        setIsProcessing(true);
        try {
            const result = await registerOpenTabPaymentAction({
                openTabId: activeTab.id,
                amount: paidAmount,
                paymentMethod,
            });

            if (!result.success) {
                alert(result.message);
                return;
            }

            setAmountReceived('');
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloseTab = async () => {
        if (!activeTab) return;

        setIsProcessing(true);
        try {
            const result = await closeOpenTabAction(activeTab.id);

            if (!result.success) {
                alert(result.message);
                return;
            }

            await loadData();
            setSelectedTabId('');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-white">Cargando POS Sport Bar...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="border-b border-slate-800 bg-slate-900/95 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">POS Sport Bar</h1>
                        <p className="text-sm text-slate-400">{layout?.name || 'Table Pong'} · cuentas abiertas y consumo incremental</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <CurrencyCalculator />
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                            Ruta nueva en paralelo al POS actual
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid min-h-[calc(100vh-81px)] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
                <aside className="border-r border-slate-800 bg-slate-900/60 p-4">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Zonas</h2>
                    <div className="mb-4 flex flex-wrap gap-2">
                        {layout?.serviceZones.map(zone => (
                            <button
                                key={zone.id}
                                onClick={() => setSelectedZoneId(zone.id)}
                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${selectedZoneId === zone.id ? 'bg-primary text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                            >
                                {zone.name}
                            </button>
                        ))}
                    </div>

                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Mesas y estaciones</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {selectedZone?.tablesOrStations.map(table => {
                            const tab = table.openTabs[0];
                            const isSelected = table.id === selectedTableId;

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => {
                                        setSelectedTableId(table.id);
                                        setSelectedTabId(tab?.id || '');
                                    }}
                                    className={`rounded-2xl border p-4 text-left transition ${isSelected ? 'border-primary bg-primary/15' : 'border-slate-700 bg-slate-800/80 hover:border-slate-500'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold">{table.name}</span>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${tab ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                                            {tab ? 'ACTIVA' : 'LIBRE'}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                        {table.stationType} · Cap. {table.capacity}
                                    </div>
                                    {tab && (
                                        <div className="mt-3 text-sm font-semibold text-primary">
                                            <PriceDisplay usd={tab.balanceDue} rate={exchangeRate} size="sm" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selectedTable && !activeTab && (
                        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                            <h3 className="mb-3 font-bold">Abrir cuenta</h3>
                            <input
                                value={customerLabel}
                                onChange={(event) => setCustomerLabel(event.target.value)}
                                placeholder="Cliente o referencia"
                                className="mb-3 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-primary"
                            />
                            <div className="mb-3 flex items-center gap-2">
                                <span className="text-sm text-slate-400">Invitados</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={guestCount}
                                    onChange={(event) => setGuestCount(Math.max(1, Number(event.target.value) || 1))}
                                    className="w-20 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                            </div>
                            <button
                                onClick={handleOpenTab}
                                disabled={isProcessing}
                                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                                Abrir cuenta
                            </button>
                        </div>
                    )}
                </aside>

                <main className="border-r border-slate-800 bg-slate-950">
                    <div className="border-b border-slate-800 px-4 py-3">
                        <div className="mb-3 flex flex-wrap gap-2">
                            {categories.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${selectedCategory === category.id ? 'bg-primary text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                                >
                                    <span className="mr-2">{getCategoryIcon(category.name)}</span>
                                    {category.name}
                                </button>
                            ))}
                        </div>

                        {activeTab ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                Cuenta activa: <b>{activeTab.customerLabel || selectedTable?.name}</b> · {selectedTable?.name} · {activeTab.guestCount} invitados
                            </div>
                        ) : (
                            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                                Selecciona una mesa y abre una cuenta para empezar a cargar consumos.
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 2xl:grid-cols-4">
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleAddToCart(item)}
                                disabled={!activeTab}
                                className="flex h-36 flex-col justify-between rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left shadow-lg transition hover:border-primary/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <div className="line-clamp-2 text-lg font-bold">{item.name}</div>
                                <div className="text-3xl font-black text-primary">
                                    <PriceDisplay usd={item.price} rate={exchangeRate} size="lg" />
                                </div>
                            </button>
                        ))}
                    </div>
                </main>

                <aside className="bg-slate-900/80 p-4">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Cuenta actual</h2>

                    {!activeTab ? (
                        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 text-center text-slate-400">
                            No hay cuenta abierta en la mesa seleccionada.
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-lg font-bold">{activeTab.customerLabel || selectedTable?.name}</div>
                                        <div className="text-sm text-slate-400">{activeTab.tabCode} · {activeTab.status}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs uppercase tracking-wide text-slate-400">Saldo</div>
                                        <div className="text-2xl font-black text-primary">
                                            <PriceDisplay usd={activeTab.balanceDue} rate={exchangeRate} size="lg" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="font-bold">Carrito temporal</h3>
                                    <span className="text-sm font-semibold text-primary">
                                        <PriceDisplay usd={cartTotal} rate={exchangeRate} size="md" />
                                    </span>
                                </div>

                                <div className="max-h-64 space-y-3 overflow-y-auto">
                                    {cart.length === 0 && (
                                        <div className="text-sm text-slate-400">Aún no has agregado items para esta tanda.</div>
                                    )}
                                    {cart.map((item, index) => (
                                        <div key={`${item.menuItemId}-${index}`} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold">{item.quantity}x {item.name}</div>
                                                    {item.modifiers.length > 0 && (
                                                        <div className="mt-1 text-xs text-slate-400">
                                                            {item.modifiers.map(modifier => modifier.name).join(', ')}
                                                        </div>
                                                    )}
                                                    {item.notes && (
                                                        <div className="mt-1 text-xs italic text-primary">{item.notes}</div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(index)}
                                                    className="text-xs font-semibold text-red-400 hover:text-red-300"
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                            <div className="mt-2 text-right text-sm font-bold text-primary">
                                                <PriceDisplay usd={item.lineTotal} rate={exchangeRate} size="sm" />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleSendToTab}
                                    disabled={cart.length === 0 || isProcessing}
                                    className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-black text-white transition hover:bg-primary/90 disabled:opacity-50"
                                >
                                    Agregar consumo a la cuenta
                                </button>
                            </div>

                            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                                <h3 className="mb-3 font-bold">Pagos</h3>
                                <div className="mb-3 grid grid-cols-4 gap-2">
                                    {['CASH', 'CARD', 'MOBILE_PAY', 'TRANSFER'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method as 'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY')}
                                            className={`rounded-lg px-2 py-2 text-xs font-bold ${paymentMethod === method ? 'bg-emerald-500 text-black' : 'bg-slate-900 text-slate-200'}`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    value={amountReceived}
                                    onChange={(event) => setAmountReceived(event.target.value)}
                                    placeholder="Monto a registrar"
                                    className="mb-3 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 outline-none focus:border-emerald-500"
                                />
                                <button
                                    onClick={handleRegisterPayment}
                                    disabled={paidAmount <= 0 || isProcessing}
                                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    Registrar pago
                                </button>
                                <button
                                    onClick={handleCloseTab}
                                    disabled={activeTab.balanceDue > 0 || isProcessing}
                                    className="mt-3 w-full rounded-xl border border-slate-600 px-4 py-3 font-bold text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
                                >
                                    Cerrar cuenta
                                </button>
                            </div>

                            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                                <h3 className="mb-3 font-bold">Consumos cargados</h3>
                                <div className="max-h-64 space-y-3 overflow-y-auto">
                                    {activeTab.orders.length === 0 && (
                                        <div className="text-sm text-slate-400">Todavía no hay órdenes parciales cargadas.</div>
                                    )}
                                    {activeTab.orders.map(order => (
                                        <div key={order.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold">{order.orderNumber}</div>
                                                <div className="text-sm font-bold text-primary">${order.total.toFixed(2)}</div>
                                            </div>
                                            <div className="mt-1 text-xs text-slate-400">
                                                {new Date(order.createdAt).toLocaleString('es-VE')} · {order.kitchenStatus}
                                            </div>
                                            <div className="mt-2 text-sm text-slate-300">
                                                {order.items.map(item => `${item.quantity}x ${item.itemName}`).join(', ')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                                <h3 className="mb-3 font-bold">Pagos registrados</h3>
                                <div className="space-y-2">
                                    {activeTab.paymentSplits.length === 0 && (
                                        <div className="text-sm text-slate-400">Sin pagos todavía.</div>
                                    )}
                                    {activeTab.paymentSplits.map(payment => (
                                        <div key={payment.id} className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm">
                                            <div>
                                                <div className="font-semibold">{payment.splitLabel}</div>
                                                <div className="text-xs text-slate-400">{payment.paymentMethod || 'N/D'}</div>
                                            </div>
                                            <div className="font-bold text-emerald-300">${payment.paidAmount.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </aside>
            </div>

            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900">
                        <div className="border-b border-slate-800 p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold">{selectedItemForModifier.name}</h3>
                                    <p className="mt-1 text-xl font-bold text-primary">${selectedItemForModifier.price.toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={() => setShowModifierModal(false)}
                                    className="text-2xl text-slate-400 hover:text-white"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 p-5">
                            {selectedItemForModifier.modifierGroups.map(groupRel => {
                                const group = groupRel.modifierGroup;
                                const totalSelected = currentModifiers
                                    .filter(modifier => modifier.groupId === group.id)
                                    .reduce((sum, modifier) => sum + modifier.quantity, 0);

                                return (
                                    <div key={group.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div className="font-bold">{group.name}</div>
                                            <div className="text-xs text-slate-400">
                                                {totalSelected} / {group.maxSelections}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {group.modifiers.map(modifier => {
                                                const selectedModifier = currentModifiers.find(
                                                    current => current.id === modifier.id && current.groupId === group.id
                                                );
                                                const quantity = selectedModifier?.quantity || 0;
                                                const isRadio = group.maxSelections === 1;

                                                return (
                                                    <div key={modifier.id} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2">
                                                        <div>
                                                            <div className="font-medium">{modifier.name}</div>
                                                            {modifier.priceAdjustment !== 0 && (
                                                                <div className="text-xs text-slate-400">
                                                                    +${modifier.priceAdjustment.toFixed(2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isRadio ? (
                                                            <button
                                                                onClick={() => updateModifierQuantity(group, modifier, 1)}
                                                                className={`h-7 w-7 rounded-full border ${quantity > 0 ? 'border-primary bg-primary text-white' : 'border-slate-500'}`}
                                                            >
                                                                {quantity > 0 ? '✓' : ''}
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => updateModifierQuantity(group, modifier, -1)}
                                                                    className="h-8 w-8 rounded-lg bg-slate-700"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="w-6 text-center font-bold text-primary">{quantity}</span>
                                                                <button
                                                                    onClick={() => updateModifierQuantity(group, modifier, 1)}
                                                                    className="h-8 w-8 rounded-lg bg-primary text-white"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                                <label className="mb-2 block text-sm font-semibold text-slate-400">Notas</label>
                                <textarea
                                    value={itemNotes}
                                    onChange={(event) => setItemNotes(event.target.value)}
                                    className="h-24 w-full resize-none rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-primary"
                                    placeholder="Sin hielo, extra limón..."
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
                                <span className="font-bold">Cantidad</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                                        className="h-10 w-10 rounded-full bg-slate-700"
                                    >
                                        -
                                    </button>
                                    <span className="w-8 text-center text-xl font-bold">{itemQuantity}</span>
                                    <button
                                        onClick={() => setItemQuantity(itemQuantity + 1)}
                                        className="h-10 w-10 rounded-full bg-primary text-white"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 border-t border-slate-800 p-5">
                            <button
                                onClick={() => setShowModifierModal(false)}
                                className="flex-1 rounded-xl bg-slate-700 px-4 py-3 font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier.modifierGroups.some(group => !isGroupValid(group.modifierGroup))}
                                className="flex-[2] rounded-xl bg-primary px-4 py-3 font-black text-white disabled:opacity-50"
                            >
                                Agregar al carrito
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
