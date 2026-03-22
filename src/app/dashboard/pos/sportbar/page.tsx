'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    addItemsToOpenTabAction,
    closeOpenTabAction,
    getMenuForPOSAction,
    getSportBarLayoutAction,
    getUsersForTabAction,
    openTabAction,
    registerOpenTabPaymentAction,
    removeItemFromOpenTabAction,
    validateManagerPinAction,
    type CartItem,
} from '@/app/actions/pos.actions';
import { getExchangeRateValue } from '@/app/actions/exchange.actions';
import { printKitchenCommand, printReceipt } from '@/lib/print-command';
import { PriceDisplay } from '@/components/pos/PriceDisplay';
import { CurrencyCalculator } from '@/components/pos/CurrencyCalculator';

// ============================================================================
// TIPOS
// ============================================================================

interface ModifierOption {
    id: string; name: string; priceAdjustment: number; isAvailable: boolean;
}
interface ModifierGroup {
    id: string; name: string; minSelections: number; maxSelections: number; isRequired: boolean; modifiers: ModifierOption[];
}
interface MenuItem {
    id: string; categoryId: string; sku: string; name: string; price: number;
    modifierGroups: { modifierGroup: ModifierGroup }[];
}
interface SelectedModifier {
    groupId: string; groupName: string; id: string; name: string; priceAdjustment: number; quantity: number;
}
interface PaymentSplit {
    id: string; splitLabel: string; paymentMethod?: string; total: number; paidAmount: number; paidAt?: string;
}
interface OrderItemSummary {
    id: string; itemName: string; quantity: number; lineTotal: number;
    modifiers?: { name: string }[];
}
interface SalesOrderSummary {
    id: string; orderNumber: string; total: number; kitchenStatus: string; createdAt: string;
    createdBy?: { firstName: string; lastName: string };
    items: OrderItemSummary[];
}
interface UserSummary { id: string; firstName: string; lastName: string; role: string; }
interface OpenTabSummary {
    id: string; tabCode: string; customerLabel?: string; customerPhone?: string;
    guestCount: number; status: string; runningTotal: number; balanceDue: number;
    openedAt: string;
    openedBy: UserSummary;
    assignedWaiter?: UserSummary | null;
    closedBy?: UserSummary | null;
    orders: SalesOrderSummary[];
    paymentSplits: PaymentSplit[];
}
interface TableSummary {
    id: string; name: string; code: string; stationType: string; capacity: number;
    currentStatus: string; openTabs: OpenTabSummary[];
}
interface ZoneSummary { id: string; name: string; zoneType: string; tablesOrStations: TableSummary[]; }
interface SportBarLayout { id: string; name: string; serviceZones: ZoneSummary[]; }

const PAYMENT_LABELS: Record<string, string> = {
    CASH: '💵 Efectivo $', CARD: '💳 Tarjeta', MOBILE_PAY: '📱 Pago Móvil', TRANSFER: '🏦 Transferencia', ZELLE: '⚡ Zelle'
};
const CASHIER_ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD'];

function getRoleLabel(role: string) {
    const map: Record<string, string> = {
        OWNER: 'Dueño', ADMIN_MANAGER: 'Gerente Adm.', OPS_MANAGER: 'Gerente Ops.',
        AREA_LEAD: 'Cajera/Líder', CHEF: 'Cocina'
    };
    return map[role] || role;
}

function formatTime(d: string | Date) {
    return new Date(d).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' });
}
function formatDateTime(d: string | Date) {
    return new Date(d).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function POSSportBarPage() {
    // ── Data ──────────────────────────────────────────────────────────────────
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [layout, setLayout] = useState<SportBarLayout | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [productSearch, setProductSearch] = useState('');

    // ── Zone / Table / Tab selection ──────────────────────────────────────────
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [selectedTableId, setSelectedTableId] = useState('');

    // ── Open tab form (modal) ─────────────────────────────────────────────────
    const [showOpenTabModal, setShowOpenTabModal] = useState(false);
    const [openTabName, setOpenTabName] = useState('');
    const [openTabPhone, setOpenTabPhone] = useState('');
    const [openTabGuests, setOpenTabGuests] = useState(2);
    const [openTabWaiter, setOpenTabWaiter] = useState('');

    // ── Cart ──────────────────────────────────────────────────────────────────
    const [cart, setCart] = useState<CartItem[]>([]);

    // ── Payment ───────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY' | 'ZELLE'>('CASH');
    const [amountReceived, setAmountReceived] = useState('');
    const [paymentLines, setPaymentLines] = useState<{ method: 'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY' | 'ZELLE'; amount: string }[]>([]);
    const [useMultiPayment, setUseMultiPayment] = useState(false);
    const [includeServiceCharge, setIncludeServiceCharge] = useState(false);
    const [serviceChargeRate, setServiceChargeRate] = useState(0.10); // tasa configurable
    const [keepChangeAsTip, setKeepChangeAsTip] = useState(false);
    const [showPaymentPinModal, setShowPaymentPinModal] = useState(false);
    const [paymentPin, setPaymentPin] = useState('');
    const [paymentPinError, setPaymentPinError] = useState('');
    const [closedTabForPrint, setClosedTabForPrint] = useState<OpenTabSummary | null>(null);

    // ── Descuento ─────────────────────────────────────────────────────────────
    const [discountType, setDiscountType] = useState<'NONE' | 'DIVISAS_33' | 'CORTESIA_PERCENT'>('NONE');
    const [cortesiaPercent, setCortesiaPercent] = useState(0);
    const [cortesiaJustification, setCortesiaJustification] = useState('');
    const [showCortesiaModal, setShowCortesiaModal] = useState(false);
    const [cortesiaModalPin, setCortesiaModalPin] = useState('');
    const [cortesiaModalError, setCortesiaModalError] = useState('');

    // ── Remove item ───────────────────────────────────────────────────────────
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ orderId: string; itemId: string; itemName: string; qty: number; lineTotal: number } | null>(null);
    const [removePin, setRemovePin] = useState('');
    const [removeJustification, setRemoveJustification] = useState('');
    const [removeError, setRemoveError] = useState('');

    // ── Modifier modal ────────────────────────────────────────────────────────
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
    const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
    const [itemQuantity, setItemQuantity] = useState(1);
    const [itemNotes, setItemNotes] = useState('');

    // ── State flags ───────────────────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [layoutError, setLayoutError] = useState('');

    // ============================================================================
    // DATA LOADING
    // ============================================================================

    const loadData = async () => {
        setIsLoading(true);
        setLayoutError('');
        try {
            const [menuResult, layoutResult, usersResult, rate] = await Promise.all([
                getMenuForPOSAction(),
                getSportBarLayoutAction(),
                getUsersForTabAction(),
                getExchangeRateValue(),
            ]);
            if (menuResult.success && menuResult.data) {
                setCategories(menuResult.data);
                setSelectedCategory(prev => prev || menuResult.data[0]?.id || '');
            }
            if (layoutResult.success && layoutResult.data) {
                const nextLayout = layoutResult.data as SportBarLayout;
                setLayout(nextLayout);
                setSelectedZoneId(prev => prev || nextLayout.serviceZones[0]?.id || '');
            } else if (!layoutResult.success) {
                setLayoutError(layoutResult.message || 'Error cargando mesas');
            }
            if (usersResult.success && usersResult.data) {
                setUsers(usersResult.data);
            }
            setExchangeRate(rate);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (paymentMethod !== 'CASH' && paymentMethod !== 'ZELLE' && discountType === 'DIVISAS_33') {
            setDiscountType('NONE');
        }
    }, [paymentMethod, discountType]);

    const cortesiaPctClamped = Math.min(100, Math.max(0, cortesiaPercent));

    useEffect(() => {
        if (discountType === 'CORTESIA_PERCENT' && cortesiaPctClamped >= 99.99) {
            setServiceChargeRate(0);
            setIncludeServiceCharge(false);
            setAmountReceived('');
            setKeepChangeAsTip(false);
        }
    }, [discountType, cortesiaPctClamped]);

    useEffect(() => {
        if (!selectedCategory || !categories.length) return;
        const cat = categories.find(c => c.id === selectedCategory);
        setMenuItems(cat?.items || []);
    }, [selectedCategory, categories]);

    // ============================================================================
    // DERIVED STATE
    // ============================================================================

    const selectedZone = useMemo(
        () => layout?.serviceZones.find(z => z.id === selectedZoneId) || null,
        [layout, selectedZoneId]
    );

    const selectedTable = useMemo(
        () => selectedZone?.tablesOrStations.find(t => t.id === selectedTableId) || null,
        [selectedZone, selectedTableId]
    );

    const activeTab = useMemo(
        () => selectedTable?.openTabs[0] || null,
        [selectedTable]
    );

    const allProductsWithCategory = useMemo(() => {
        return (categories || []).flatMap((cat: any) =>
            (cat.items || []).map((item: MenuItem) => ({
                ...item,
                categoryName: cat.name,
                categoryId: cat.id,
            }))
        );
    }, [categories]);

    const filteredMenuItems = useMemo(() => {
        if (!productSearch.trim()) return menuItems;
        const q = productSearch.toLowerCase().trim();
        return allProductsWithCategory.filter(
            (p: MenuItem & { categoryName?: string; categoryId?: string }) =>
                p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
        );
    }, [productSearch, menuItems, allProductsWithCategory]);

    const displayMenuItems = productSearch.trim() ? filteredMenuItems : menuItems;

    useEffect(() => {
        if (productSearch.trim() && filteredMenuItems.length > 0) {
            const first = filteredMenuItems[0] as MenuItem & { categoryId?: string };
            if (first?.categoryId && first.categoryId !== selectedCategory) {
                setSelectedCategory(first.categoryId);
            }
        }
    }, [productSearch, filteredMenuItems, selectedCategory]);

    const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);
    const paidAmount = parseFloat(amountReceived) || 0;
    const isPagoDivisas = paymentMethod === 'CASH' || paymentMethod === 'ZELLE';

    // Balance a cobrar (divisas / cortesía %)
    const amountToCharge = activeTab
        ? (discountType === 'DIVISAS_33'
            ? activeTab.balanceDue * 2 / 3
            : discountType === 'CORTESIA_PERCENT'
                ? activeTab.balanceDue * (1 - cortesiaPctClamped / 100)
                : activeTab.balanceDue)
        : 0;
    const serviceCharge = Math.round(amountToCharge * serviceChargeRate * 100) / 100;
    const suggestedTotal = Math.round((amountToCharge + serviceCharge) * 100) / 100;
    const amountWithService = suggestedTotal; // alias para compatibilidad
    const receivedFloat = parseFloat(amountReceived) || 0;
    const changeFromSuggested = receivedFloat > suggestedTotal + 0.005 ? Math.round((receivedFloat - suggestedTotal) * 100) / 100 : 0;
    const hasChange = changeFromSuggested > 0.005;
    const computedTip = keepChangeAsTip && hasChange ? changeFromSuggested : 0;
    const computedChange = !keepChangeAsTip && hasChange ? changeFromSuggested : 0;
    // Pago mixto
    const multiTotal = paymentLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const multiRemaining = (includeServiceCharge ? amountWithService : amountToCharge) - multiTotal;
    const multiValid = useMultiPayment ? (paymentLines.length > 1 && multiTotal >= (includeServiceCharge ? amountWithService : amountToCharge) - 0.001) : true;

    // ============================================================================
    // OPEN TAB
    // ============================================================================

    const handleOpenTab = async () => {
        if (!selectedTable) return;
        if (!openTabName.trim()) { alert('El nombre del cliente es obligatorio'); return; }
        if (!openTabPhone.trim()) { alert('El teléfono del cliente es obligatorio'); return; }
        setIsProcessing(true);
        try {
            const result = await openTabAction({
                tableOrStationId: selectedTable.id,
                customerLabel: openTabName.trim(),
                customerPhone: openTabPhone.trim(),
                guestCount: openTabGuests,
                waiterLabel: openTabWaiter ? `Mesonero ${openTabWaiter}` : undefined,
            });
            if (!result.success) { alert(result.message); return; }
            setShowOpenTabModal(false);
            setOpenTabName(''); setOpenTabPhone(''); setOpenTabGuests(2); setOpenTabWaiter('');
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================================
    // CART & MODIFIERS
    // ============================================================================

    const handleAddToCart = (item: MenuItem & { categoryId?: string }) => {
        if (!activeTab) return;
        if (item.categoryId) setSelectedCategory(item.categoryId);
        setSelectedItemForModifier(item);
        setCurrentModifiers([]);
        setItemQuantity(1);
        setItemNotes('');
        setShowModifierModal(true);
    };

    const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
        const currentInGroup = currentModifiers.filter(m => m.groupId === group.id);
        const totalSelected = currentInGroup.reduce((s, m) => s + m.quantity, 0);
        const existing = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
        const currentQty = existing?.quantity || 0;

        if (change > 0) {
            if (group.maxSelections > 1 && totalSelected >= group.maxSelections) return;
            if (group.maxSelections === 1) {
                const others = currentModifiers.filter(m => m.groupId !== group.id);
                setCurrentModifiers([...others, { groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: 1 }]);
                return;
            }
        }
        const newQty = currentQty + change;
        if (newQty < 0) return;
        let mods = [...currentModifiers];
        if (existing) {
            mods = newQty === 0 ? mods.filter(m => !(m.id === modifier.id && m.groupId === group.id)) : mods.map(m => m.id === modifier.id && m.groupId === group.id ? { ...m, quantity: newQty } : m);
        } else if (newQty > 0) {
            mods.push({ groupId: group.id, groupName: group.name, id: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment, quantity: newQty });
        }
        setCurrentModifiers(mods);
    };

    const isGroupValid = (group: ModifierGroup) => {
        if (!group.isRequired) return true;
        return currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0) >= group.minSelections;
    };

    const confirmAddToCart = () => {
        if (!selectedItemForModifier) return;
        if (!selectedItemForModifier.modifierGroups.every(g => isGroupValid(g.modifierGroup))) return;
        const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment * m.quantity, 0);
        const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;
        const exploded = currentModifiers.flatMap(m => Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment }));
        setCart(prev => [...prev, {
            menuItemId: selectedItemForModifier.id,
            name: selectedItemForModifier.name,
            quantity: itemQuantity,
            unitPrice: selectedItemForModifier.price,
            modifiers: exploded,
            notes: itemNotes || undefined,
            lineTotal,
        }]);
        setShowModifierModal(false);
    };

    // ============================================================================
    // SEND TO TAB
    // ============================================================================

    const handleSendToTab = async () => {
        if (!activeTab || cart.length === 0) return;
        setIsProcessing(true);
        try {
            const result = await addItemsToOpenTabAction({ openTabId: activeTab.id, items: cart });
            if (!result.success) { alert(result.message); return; }
            if (result.data?.kitchenStatus === 'SENT') {
                printKitchenCommand({
                    orderNumber: result.data.orderNumber,
                    orderType: 'RESTAURANT',
                    customerName: activeTab.customerLabel || selectedTable?.name,
                    items: cart.map(i => ({ name: i.name, quantity: i.quantity, modifiers: i.modifiers.map(m => m.name), notes: i.notes })),
                    createdAt: new Date(),
                });
            }
            setCart([]);
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================================
    // PAYMENT (requiere PIN de cajera)
    // ============================================================================

    const handlePaymentPinConfirm = async () => {
        if (!activeTab) return;
        if (discountType === 'CORTESIA_PERCENT' && !cortesiaJustification.trim()) {
            setPaymentPinError('La cortesía requiere justificación (configúrela en el botón Cortesía)');
            return;
        }
        if (useMultiPayment) {
            if (!multiValid || paymentLines.filter(l => parseFloat(l.amount) > 0).length < 2) {
                setPaymentPinError('Pago mixto: asigne al menos 2 métodos y cubra el total');
                return;
            }
        } else if (discountType === 'CORTESIA_PERCENT' && cortesiaPctClamped >= 99.99) {
            /* cierre sin cobro: solo PIN */
        } else if (!includeServiceCharge && serviceChargeRate === 0 && paidAmount <= 0) {
            setPaymentPinError('Ingrese el monto a cobrar');
            return;
        } else if (serviceChargeRate > 0 && receivedFloat <= 0) {
            setPaymentPinError('Ingrese el monto recibido del cliente');
            return;
        }
        setPaymentPinError('');
        setIsProcessing(true);
        try {
            const pinResult = await validateManagerPinAction(paymentPin);
            if (!pinResult.success) {
                setPaymentPinError('PIN incorrecto o sin permisos de cajera');
                return;
            }
            const discountAmount =
                discountType === 'DIVISAS_33' ? activeTab.balanceDue / 3
                    : discountType === 'CORTESIA_PERCENT' ? activeTab.balanceDue * (cortesiaPctClamped / 100)
                        : 0;
            const discountLabel =
                discountType === 'DIVISAS_33' ? ' · -33.33% Divisas'
                    : discountType === 'CORTESIA_PERCENT' ? ` · Cortesía ${cortesiaPctClamped}%`
                        : '';
            const saleDiscountType = discountType === 'DIVISAS_33' ? 'DIVISAS_33' : discountType === 'CORTESIA_PERCENT' ? 'CORTESIA_PERCENT' : undefined;
            const saleDiscountReason =
                discountType === 'DIVISAS_33' ? 'Pago en Divisas (33.33%)'
                    : discountType === 'CORTESIA_PERCENT' ? `Cortesía ${cortesiaPctClamped}% — ${cortesiaJustification.trim()}`
                        : undefined;
            const authorizedById = pinResult.data?.managerId && pinResult.data.managerId !== 'demo-master-id' ? pinResult.data.managerId : undefined;

            let result;
            if (useMultiPayment && paymentLines.filter(l => parseFloat(l.amount) > 0).length > 1) {
                const splits = paymentLines.filter(l => parseFloat(l.amount) > 0).map(l => ({ method: l.method, amount: parseFloat(l.amount) }));
                result = await registerOpenTabPaymentAction({
                    openTabId: activeTab.id,
                    amount: 0,
                    paymentMethod: 'CASH',
                    paymentSplits: splits,
                    discountAmount: discountAmount > 0 ? discountAmount : undefined,
                    saleDiscountType,
                    saleDiscountReason,
                    authorizedById,
                    notes: discountType === 'CORTESIA_PERCENT' ? cortesiaJustification.trim() : undefined,
                });
                if (!result.success) { alert(result.message); return; }
            } else if (discountType === 'CORTESIA_PERCENT' && cortesiaPctClamped >= 99.99) {
                const baseLabel = `${PAYMENT_LABELS[paymentMethod] || paymentMethod}${discountLabel} – ${pinResult.data?.managerName || ''}`;
                result = await registerOpenTabPaymentAction({
                    openTabId: activeTab.id,
                    amount: 0,
                    paymentMethod,
                    splitLabel: baseLabel,
                    discountAmount,
                    saleDiscountType: 'CORTESIA_PERCENT',
                    saleDiscountReason,
                    authorizedById,
                    notes: cortesiaJustification.trim(),
                });
                if (!result.success) { alert(result.message); return; }
            } else {
                const baseLabel = `${PAYMENT_LABELS[paymentMethod] || paymentMethod}${discountLabel} – ${pinResult.data?.managerName || ''}`;
                if (serviceChargeRate > 0 && !includeServiceCharge) {
                    result = await registerOpenTabPaymentAction({
                        openTabId: activeTab.id,
                        amount: amountToCharge,
                        paymentMethod,
                        splitLabel: baseLabel,
                        discountAmount: discountAmount > 0 ? discountAmount : undefined,
                        saleDiscountType,
                        saleDiscountReason,
                        authorizedById,
                        notes: discountType === 'CORTESIA_PERCENT' ? cortesiaJustification.trim() : undefined,
                        serviceChargeRate,
                        serviceChargeAmount: serviceCharge,
                        tipAmount: computedTip,
                        amountReceived: receivedFloat,
                        changeReturned: computedChange,
                    });
                } else {
                    result = await registerOpenTabPaymentAction({
                        openTabId: activeTab.id,
                        amount: includeServiceCharge ? activeTab.balanceDue : paidAmount,
                        paymentMethod,
                        splitLabel: baseLabel,
                        discountAmount: discountAmount > 0 ? discountAmount : undefined,
                        saleDiscountType,
                        saleDiscountReason,
                        authorizedById,
                        notes: discountType === 'CORTESIA_PERCENT' ? cortesiaJustification.trim() : undefined,
                        includeServiceCharge,
                    });
                }
                if (!result.success) { alert(result.message); return; }
            }
            setAmountReceived('');
            setPaymentLines([]);
            setUseMultiPayment(false);
            setPaymentPin('');
            setDiscountType('NONE');
            setCortesiaPercent(0);
            setCortesiaJustification('');
            setIncludeServiceCharge(false);
            setServiceChargeRate(0.10);
            setKeepChangeAsTip(false);
            setShowPaymentPinModal(false);
            if (result.data?.status === 'CLOSED') {
                setClosedTabForPrint(result.data as OpenTabSummary);
            }
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCortesiaModalConfirm = async () => {
        if (!cortesiaJustification.trim()) {
            setCortesiaModalError('La justificación es obligatoria');
            return;
        }
        setCortesiaModalError('');
        setIsProcessing(true);
        try {
            const res = await validateManagerPinAction(cortesiaModalPin);
            if (!res.success) {
                setCortesiaModalError('PIN incorrecto o sin permisos');
                return;
            }
            setDiscountType('CORTESIA_PERCENT');
            setShowCortesiaModal(false);
            setCortesiaModalPin('');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCloseTab = async () => {
        if (!activeTab) return;
        if (activeTab.balanceDue > 0.005) { alert('La cuenta aún tiene saldo pendiente'); return; }
        if (!confirm('¿Cerrar esta cuenta?')) return;
        setIsProcessing(true);
        try {
            const result = await closeOpenTabAction(activeTab.id);
            if (!result.success) { alert(result.message); return; }
            await loadData();
            setSelectedTableId('');
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================================
    // REMOVE ITEM
    // ============================================================================

    const openRemoveModal = (orderId: string, item: OrderItemSummary) => {
        setRemoveTarget({ orderId, itemId: item.id, itemName: item.itemName, qty: item.quantity, lineTotal: item.lineTotal });
        setRemovePin('');
        setRemoveJustification('');
        setRemoveError('');
        setShowRemoveModal(true);
    };

    const handleRemoveItem = async () => {
        if (!removeTarget || !activeTab) return;
        if (!removeJustification.trim()) { setRemoveError('La justificación es obligatoria'); return; }
        setIsProcessing(true);
        setRemoveError('');
        try {
            const result = await removeItemFromOpenTabAction({
                openTabId: activeTab.id,
                orderId: removeTarget.orderId,
                itemId: removeTarget.itemId,
                cashierPin: removePin,
                justification: removeJustification,
            });
            if (!result.success) { setRemoveError(result.message); return; }
            setShowRemoveModal(false);
            await loadData();
        } finally {
            setIsProcessing(false);
        }
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="text-4xl mb-4">🍸</div>
                    <div className="text-xl font-bold">Cargando Sport Bar...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🍸</span>
                    <div>
                        <h1 className="text-xl font-black">POS Sport Bar</h1>
                        <p className="text-xs text-slate-400">Cuentas abiertas · Trazabilidad completa</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab && (
                        <CurrencyCalculator
                            totalUsd={Number(activeTab.balanceDue.toFixed(2))}
                            onRateUpdated={setExchangeRate}
                        />
                    )}
                    <div className="text-xs text-slate-400 font-mono">
                        {new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' })}
                    </div>
                </div>
            </div>

            {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ══ LEFT: TABLE GRID ═══════════════════════════════════════════ */}
                <aside className="w-72 xl:w-80 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
                    {/* Zone selector */}
                    <div className="p-3 border-b border-slate-800 flex gap-2">
                        {layout?.serviceZones.map(z => (
                            <button
                                key={z.id}
                                onClick={() => { setSelectedZoneId(z.id); setSelectedTableId(''); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${selectedZoneId === z.id ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                            >
                                {z.zoneType === 'BAR' ? '🍺' : '🌿'} {z.name}
                            </button>
                        ))}
                        {!layout && !layoutError && (
                            <div className="flex-1 text-center text-xs text-slate-500 py-2">Cargando zonas...</div>
                        )}
                        {layoutError && (
                            <button onClick={loadData} className="flex-1 text-xs text-red-400 hover:text-red-300 py-2 text-center">
                                ⚠️ Error · Reintentar
                            </button>
                        )}
                    </div>

                    {/* Error detail */}
                    {layoutError && (
                        <div className="px-3 py-2 text-[10px] text-red-400 bg-red-950/30 border-b border-red-900/30">
                            {layoutError}
                        </div>
                    )}

                    {/* Table grid */}
                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="grid grid-cols-4 gap-1.5">
                            {selectedZone?.tablesOrStations.map(table => {
                                const tab = table.openTabs[0];
                                const isSelected = table.id === selectedTableId;
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTableId(table.id)}
                                        className={`rounded-xl p-2 text-left transition border-2 ${
                                            isSelected
                                                ? 'border-amber-400 bg-amber-500/15'
                                                : tab
                                                ? 'border-emerald-600/60 bg-emerald-900/20 hover:border-emerald-500'
                                                : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="text-[10px] font-black text-center leading-none">{table.code}</div>
                                        {tab ? (
                                            <>
                                                <div className="mt-1 text-[8px] text-emerald-300 truncate leading-none">{tab.customerLabel}</div>
                                                <div className="text-[9px] font-bold text-amber-400 text-center">${tab.balanceDue.toFixed(0)}</div>
                                            </>
                                        ) : (
                                            <div className="mt-1 text-[8px] text-slate-500 text-center">LIBRE</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected table info & open tab CTA */}
                    {selectedTable && (
                        <div className="border-t border-slate-800 p-3 bg-slate-900">
                            {!activeTab ? (
                                <button
                                    onClick={() => setShowOpenTabModal(true)}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm transition"
                                >
                                    + Abrir cuenta en {selectedTable.name}
                                </button>
                            ) : (
                                <div className="space-y-1 text-xs">
                                    <div className="font-bold text-emerald-300 truncate">{activeTab.customerLabel}</div>
                                    {activeTab.customerPhone && (
                                        <div className="text-slate-400">📞 {activeTab.customerPhone}</div>
                                    )}
                                    <div className="text-slate-400">
                                        Abrió: <span className="text-white">{activeTab.openedBy.firstName} {activeTab.openedBy.lastName}</span>
                                        <span className="text-slate-500"> · {formatTime(activeTab.openedAt)}</span>
                                    </div>
                                    {activeTab.assignedWaiter && (
                                        <div className="text-slate-400">
                                            Mesonero: <span className="text-white">{(activeTab as any).waiterLabel || '—'}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* ══ CENTER: MENU ════════════════════════════════════════════════ */}
                <main className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950 overflow-hidden">
                    {/* Search + Categories */}
                    <div className="p-3 border-b border-slate-800 space-y-2 shrink-0">
                        {/* Active tab banner */}
                        {activeTab ? (
                            <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                                <span className="text-emerald-200">
                                    <b>{selectedTable?.name}</b> · {activeTab.customerLabel}
                                    {activeTab.customerPhone && <> · {activeTab.customerPhone}</>}
                                </span>
                                <span className="text-emerald-400 font-black">
                                    <PriceDisplay usd={activeTab.balanceDue} rate={exchangeRate} size="sm" />
                                </span>
                            </div>
                        ) : selectedTable ? (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-400">
                                {selectedTable.name} · Sin cuenta abierta — presiona &quot;Abrir cuenta&quot; para empezar
                            </div>
                        ) : (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-500">
                                Selecciona una mesa para empezar
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                            <input
                                type="text"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                placeholder="Buscar producto..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                            {productSearch && (
                                <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">✕</button>
                            )}
                        </div>

                        {/* Categories */}
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => { setSelectedCategory(cat.id); setProductSearch(''); }}
                                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedCategory === cat.id ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Menu items */}
                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                            {displayMenuItems.map((item: MenuItem & { categoryName?: string }) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddToCart(item)}
                                    disabled={!activeTab}
                                    className="flex flex-col justify-between rounded-2xl border border-slate-700 bg-slate-900 p-3 text-left shadow transition hover:border-amber-500/50 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed h-24"
                                >
                                    {item.categoryName && productSearch && (
                                        <span className="text-[10px] mb-0.5 block text-amber-400/80">{item.categoryName}</span>
                                    )}
                                    <div className="text-sm font-bold line-clamp-2 leading-tight">{item.name}</div>
                                    <div className="text-lg font-black text-amber-400">
                                        <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                                    </div>
                                </button>
                            ))}
                            {displayMenuItems.length === 0 && (
                                <div className="col-span-full text-center text-slate-500 py-12 text-sm">
                                    {productSearch ? `Sin resultados para "${productSearch}"` : 'Sin productos en esta categoría'}
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                {/* ══ RIGHT: ACCOUNT PANEL ════════════════════════════════════════ */}
                <aside className="w-80 xl:w-96 shrink-0 bg-slate-900/80 flex flex-col overflow-hidden">
                    {!activeTab ? (
                        <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400 text-sm">
                            {selectedTable ? 'Abre una cuenta para gestionar consumos' : 'Selecciona una mesa del panel izquierdo'}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Tab header */}
                            <div className="p-3 border-b border-slate-800 bg-slate-900 space-y-1.5 shrink-0">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-black text-base">{activeTab.customerLabel}</div>
                                        {activeTab.customerPhone && (
                                            <div className="text-xs text-slate-400">📞 {activeTab.customerPhone}</div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase">Saldo</div>
                                        <div className="text-xl font-black text-amber-400">
                                            <PriceDisplay usd={activeTab.balanceDue} rate={exchangeRate} size="md" showBs={false} />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-500 space-y-0.5">
                                    <div>🔓 Abrió: <span className="text-slate-300">{activeTab.openedBy.firstName} {activeTab.openedBy.lastName}</span> · {formatDateTime(activeTab.openedAt)}</div>
                                    {(activeTab as any).waiterLabel && (
                                        <div>👤 Mesonero: <span className="text-slate-300">{(activeTab as any).waiterLabel}</span></div>
                                    )}
                                    <div>🏷️ {activeTab.tabCode} · {activeTab.guestCount} pax · <span className={activeTab.status === 'OPEN' ? 'text-emerald-400' : 'text-amber-400'}>{activeTab.status}</span></div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {/* Temporary cart */}
                                <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Carrito (nueva tanda)</span>
                                        <span className="text-xs font-bold text-amber-400">
                                            <PriceDisplay usd={cartTotal} rate={exchangeRate} size="sm" showBs={false} />
                                        </span>
                                    </div>
                                    {cart.length === 0 ? (
                                        <div className="text-xs text-slate-500 text-center py-2">Agrega items del menú</div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {cart.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs bg-slate-900 rounded-lg px-2 py-1.5">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{item.quantity}× {item.name}</div>
                                                        {item.modifiers.length > 0 && <div className="text-slate-500 truncate">{item.modifiers.map(m => m.name).join(', ')}</div>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                                        <span className="text-amber-400 font-bold">${item.lineTotal.toFixed(2)}</span>
                                                        <button onClick={() => setCart(p => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 text-base leading-none">×</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSendToTab}
                                        disabled={cart.length === 0 || isProcessing}
                                        className="mt-2 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-black transition disabled:opacity-40"
                                    >
                                        Agregar consumo a la cuenta →
                                    </button>
                                </div>

                                {/* Consumed orders */}
                                {activeTab.orders.length > 0 && (
                                    <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Consumos cargados</div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {activeTab.orders.map(order => (
                                                <div key={order.id} className="bg-slate-900 rounded-lg p-2">
                                                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                                        <span>{order.orderNumber}</span>
                                                        <span className="flex items-center gap-1">
                                                            {order.createdBy && <span>{order.createdBy.firstName}</span>}
                                                            · {formatTime(order.createdAt)}
                                                        </span>
                                                    </div>
                                                    {order.items.map(item => (
                                                        <div key={item.id} className="flex items-center justify-between text-xs py-0.5">
                                                            <span className="text-slate-300 flex-1 truncate">{item.quantity}× {item.itemName}</span>
                                                            <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                                                <span className="text-slate-400">${item.lineTotal.toFixed(2)}</span>
                                                                <button
                                                                    onClick={() => openRemoveModal(order.id, item)}
                                                                    className="text-red-500 hover:text-red-400 text-[10px] font-bold border border-red-800/50 rounded px-1 py-0.5 hover:border-red-600"
                                                                    title="Eliminar (requiere PIN cajera)"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="text-right text-[10px] text-amber-400 font-bold mt-1">${order.total.toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Payment section */}
                                <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-2">Cobrar cuenta</div>

                                    {/* 1. Descuento */}
                                    <div className="mb-3">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">1. Descuento</p>
                                        <div className="flex gap-1.5 flex-wrap">
                                            <button
                                                onClick={() => { setDiscountType('NONE'); setCortesiaPercent(0); setCortesiaJustification(''); }}
                                                className={`flex-1 min-w-[4.5rem] py-1.5 text-xs font-bold rounded-lg transition ${discountType === 'NONE' ? 'bg-slate-500 text-white ring-1 ring-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`}
                                            >
                                                Normal
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!isPagoDivisas) return;
                                                    setDiscountType('DIVISAS_33');
                                                    setCortesiaPercent(0);
                                                    setCortesiaJustification('');
                                                }}
                                                disabled={!isPagoDivisas}
                                                title={!isPagoDivisas ? 'Solo con Efectivo o Zelle' : 'Descuento por pago en divisas'}
                                                className={`flex-1 min-w-[4.5rem] py-1.5 text-xs font-bold rounded-lg transition ${discountType === 'DIVISAS_33' ? 'bg-blue-600 text-white ring-1 ring-white' : isPagoDivisas ? 'bg-slate-900 text-slate-300 hover:bg-slate-700' : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-50'}`}
                                            >
                                                -33.33%
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCortesiaModalPin('');
                                                    setCortesiaModalError('');
                                                    if (cortesiaPercent < 0.01) setCortesiaPercent(50);
                                                    setShowCortesiaModal(true);
                                                }}
                                                className={`flex-1 min-w-[4.5rem] py-1.5 text-xs font-bold rounded-lg transition ${discountType === 'CORTESIA_PERCENT' ? 'bg-purple-600 text-white ring-1 ring-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`}
                                            >
                                                Cortesía
                                            </button>
                                        </div>
                                        {discountType === 'DIVISAS_33' && (
                                            <p className="text-[10px] text-blue-400 mt-1">
                                                Descuento: -${(activeTab.balanceDue / 3).toFixed(2)} → Total: ${(activeTab.balanceDue * 2 / 3).toFixed(2)}
                                            </p>
                                        )}
                                        {discountType === 'CORTESIA_PERCENT' && (
                                            <p className="text-[10px] text-purple-300 mt-1">
                                                Cortesía {cortesiaPctClamped}%: -${(activeTab.balanceDue * (cortesiaPctClamped / 100)).toFixed(2)} → A cobrar: ${amountToCharge.toFixed(2)}
                                                {cortesiaJustification.trim() ? <span className="block text-slate-500 truncate" title={cortesiaJustification}>“{cortesiaJustification.trim()}”</span> : null}
                                            </p>
                                        )}
                                    </div>

                                    {/* 2. Método de pago + Pago Mixto */}
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">2. Forma de pago</p>
                                            <button
                                                onClick={() => { setUseMultiPayment(p => !p); setPaymentLines([]); }}
                                                className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${useMultiPayment ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                            >
                                                {useMultiPayment ? '✓ Pago Mixto' : '+ Pago Mixto'}
                                            </button>
                                        </div>
                                        {!useMultiPayment ? (
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {(['CASH', 'ZELLE', 'CARD', 'MOBILE_PAY', 'TRANSFER'] as const).map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setPaymentMethod(m)}
                                                        className={`py-2 rounded-lg text-xs font-bold transition ${paymentMethod === m ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`}
                                                    >
                                                        {PAYMENT_LABELS[m]}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {paymentLines.map((line, idx) => (
                                                    <div key={idx} className="flex gap-1.5 items-center">
                                                        <select value={line.method} onChange={e => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, method: e.target.value as any } : l))} className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white">
                                                            <option value="CASH">💵 Efectivo</option>
                                                            <option value="ZELLE">⚡ Zelle</option>
                                                            <option value="CARD">💳 Tarjeta</option>
                                                            <option value="MOBILE_PAY">📱 P.Móvil</option>
                                                            <option value="TRANSFER">🏦 Transferencia</option>
                                                        </select>
                                                        <input type="number" step="0.01" min="0" value={line.amount} onChange={e => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))} placeholder="$0" className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white text-right" />
                                                        <button onClick={() => setPaymentLines(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 font-bold">×</button>
                                                    </div>
                                                ))}
                                                <button onClick={() => setPaymentLines(prev => [...prev, { method: 'CASH', amount: multiRemaining > 0 ? multiRemaining.toFixed(2) : '' }])} className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 rounded text-xs font-bold text-slate-300">
                                                    + Agregar método
                                                </button>
                                                <div className={`text-[10px] font-bold px-1 ${multiRemaining > 0.005 ? 'text-red-400' : 'text-green-400'}`}>
                                                    ${multiTotal.toFixed(2)} / ${(includeServiceCharge ? amountWithService : amountToCharge).toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Resumen */}
                                    <div className="bg-slate-900 rounded-lg px-3 py-2 mb-2 text-xs space-y-1">
                                        <div className="flex justify-between text-slate-400">
                                            <span>Saldo</span>
                                            <span>${activeTab.balanceDue.toFixed(2)}</span>
                                        </div>
                                        {discountType === 'DIVISAS_33' && (
                                            <div className="flex justify-between text-blue-400">
                                                <span>Descuento divisas</span>
                                                <span>-${(activeTab.balanceDue / 3).toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-1">
                                            <span>A cobrar</span>
                                            <span>${(discountType === 'DIVISAS_33' ? activeTab.balanceDue * 2 / 3 : activeTab.balanceDue).toFixed(2)}</span>
                                        </div>
                                        {serviceChargeRate > 0 && (
                                            <div className="flex justify-between text-amber-400 text-[10px]">
                                                <span>{Math.round(serviceChargeRate * 100)}% Servicio</span>
                                                <span>+${serviceCharge.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {serviceChargeRate > 0 && (
                                            <div className="flex justify-between text-white text-[10px] font-bold">
                                                <span>Total c/servicio</span>
                                                <span>${suggestedTotal.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cargo por servicio configurable */}
                                    {!useMultiPayment && (
                                        <div className="mb-2">
                                            <div className="flex items-center gap-1 mb-1">
                                                <span className="text-[10px] text-slate-400 font-semibold uppercase">Servicio</span>
                                                {[0, 0.05, 0.10, 0.15].map(rate => (
                                                    <button
                                                        key={rate}
                                                        onClick={() => setServiceChargeRate(rate)}
                                                        className={`flex-1 py-1 rounded text-[10px] font-black transition ${serviceChargeRate === rate ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                                    >
                                                        {rate === 0 ? 'Sin serv.' : `${Math.round(rate * 100)}%`}
                                                    </button>
                                                ))}
                                            </div>
                                            {serviceChargeRate > 0 && (
                                                <div className="flex justify-between text-[10px] text-amber-300 px-1">
                                                    <span>+{Math.round(serviceChargeRate * 100)}% servicio</span>
                                                    <span className="font-black">+${serviceCharge.toFixed(2)} → Total ${suggestedTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Monto recibido */}
                                    {!useMultiPayment && (
                                        <input
                                            type="number"
                                            value={amountReceived}
                                            onChange={e => { setAmountReceived(e.target.value); setKeepChangeAsTip(false); }}
                                            placeholder={serviceChargeRate > 0 ? `Recibido (sugerido $${suggestedTotal.toFixed(2)})` : `Monto a recibir ($${amountToCharge.toFixed(2)})`}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none mb-1"
                                        />
                                    )}

                                    {/* Vuelto / propina */}
                                    {!useMultiPayment && hasChange && (
                                        <div className="bg-slate-900 rounded-lg px-3 py-2 mb-2 border border-slate-700">
                                            <div className="flex justify-between text-xs font-bold text-green-400 mb-1">
                                                <span>💵 Vuelto</span>
                                                <span>${changeFromSuggested.toFixed(2)}</span>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={keepChangeAsTip}
                                                    onChange={e => setKeepChangeAsTip(e.target.checked)}
                                                    className="w-3.5 h-3.5 accent-amber-500"
                                                />
                                                <span className="text-[10px] text-amber-300 font-semibold">Cliente deja el vuelto de propina</span>
                                                {keepChangeAsTip && (
                                                    <span className="ml-auto text-[10px] text-amber-400 font-black">+${computedTip.toFixed(2)} propina</span>
                                                )}
                                            </label>
                                        </div>
                                    )}

                                    {/* CurrencyCalculator */}
                                    <CurrencyCalculator
                                        totalUsd={includeServiceCharge
                                            ? Number(((discountType === 'DIVISAS_33' ? activeTab.balanceDue * 2 / 3 : activeTab.balanceDue) * 1.10).toFixed(2))
                                            : (paidAmount > 0 ? paidAmount : Number((discountType === 'DIVISAS_33' ? activeTab.balanceDue * 2 / 3 : activeTab.balanceDue).toFixed(2)))}
                                        onRateUpdated={setExchangeRate}
                                        className="w-full justify-center mb-2"
                                    />

                                    {/* Register payment (requiere PIN) */}
                                    <button
                                        onClick={() => { setPaymentPin(''); setPaymentPinError(''); setShowPaymentPinModal(true); }}
                                        disabled={(useMultiPayment ? !multiValid : (
                                            discountType === 'CORTESIA_PERCENT' && cortesiaPctClamped >= 99.99
                                                ? false
                                                : (serviceChargeRate > 0 ? receivedFloat <= 0 : (!includeServiceCharge && paidAmount <= 0))
                                        )) || isProcessing}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-black transition disabled:opacity-40"
                                    >
                                        🔐 {discountType === 'CORTESIA_PERCENT' && cortesiaPctClamped >= 99.99 ? 'Registrar cortesía (cerrar)' : 'Registrar pago'} ${useMultiPayment
                                            ? multiTotal.toFixed(2)
                                            : includeServiceCharge
                                                ? amountWithService.toFixed(2)
                                                : serviceChargeRate > 0
                                                    ? suggestedTotal.toFixed(2)
                                                    : (paidAmount > 0 ? paidAmount.toFixed(2) : '0.00')}
                                    </button>

                                    {/* Paid splits */}
                                    {activeTab.paymentSplits.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {activeTab.paymentSplits.map(p => (
                                                <div key={p.id} className="flex justify-between text-[10px] text-slate-400 bg-slate-900 rounded px-2 py-1">
                                                    <span>{p.splitLabel}</span>
                                                    <span className="text-emerald-400 font-bold">${p.paidAmount.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Close tab */}
                                    <button
                                        onClick={handleCloseTab}
                                        disabled={activeTab.balanceDue > 0.005 || isProcessing}
                                        className="mt-2 w-full py-2 border border-slate-600 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 transition disabled:opacity-30"
                                    >
                                        Cerrar cuenta (saldo $0.00)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODAL: ABRIR CUENTA                                              */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showOpenTabModal && selectedTable && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="border-b border-slate-800 p-5 flex items-center justify-between">
                            <h3 className="text-lg font-black">Abrir cuenta — {selectedTable.name}</h3>
                            <button onClick={() => setShowOpenTabModal(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Nombre del cliente <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={openTabName}
                                    onChange={e => setOpenTabName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Teléfono del cliente <span className="text-red-400">*</span></label>
                                <input
                                    type="tel"
                                    value={openTabPhone}
                                    onChange={e => setOpenTabPhone(e.target.value)}
                                    placeholder="Ej: 0414-1234567"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Número de personas</label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setOpenTabGuests(Math.max(1, openTabGuests - 1))} className="w-9 h-9 bg-slate-800 rounded-lg font-bold text-lg">−</button>
                                        <span className="flex-1 text-center font-black text-lg">{openTabGuests}</span>
                                        <button onClick={() => setOpenTabGuests(openTabGuests + 1)} className="w-9 h-9 bg-amber-600 rounded-lg font-bold text-lg">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Mesonero asignado</label>
                                    <select
                                        value={openTabWaiter}
                                        onChange={e => setOpenTabWaiter(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="">— Ninguno —</option>
                                        <option value="1">Mesonero 1</option>
                                        <option value="2">Mesonero 2</option>
                                        <option value="3">Mesonero 3</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-800 p-4 flex gap-3">
                            <button onClick={() => setShowOpenTabModal(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm transition">Cancelar</button>
                            <button
                                onClick={handleOpenTab}
                                disabled={isProcessing || !openTabName.trim() || !openTabPhone.trim()}
                                className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm transition disabled:opacity-50"
                            >
                                {isProcessing ? 'Abriendo...' : '✓ Abrir cuenta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODAL: CORTESÍA (PIN + % + justificación)                         */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showCortesiaModal && activeTab && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-purple-800/50 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="border-b border-slate-800 p-5 flex items-center justify-between">
                            <h3 className="text-lg font-black text-purple-300">🎁 Cortesía</h3>
                            <button type="button" onClick={() => setShowCortesiaModal(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Descuento (0–100%)</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        value={cortesiaPercent}
                                        onChange={e => setCortesiaPercent(parseFloat(e.target.value))}
                                        className="flex-1 accent-purple-500"
                                    />
                                    <span className="text-sm font-black text-purple-300 w-14 text-right">{cortesiaPctClamped}%</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Saldo ${activeTab.balanceDue.toFixed(2)} → A cobrar ${(activeTab.balanceDue * (1 - cortesiaPctClamped / 100)).toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Justificación <span className="text-red-400">*</span></label>
                                <textarea
                                    value={cortesiaJustification}
                                    onChange={e => setCortesiaJustification(e.target.value)}
                                    rows={3}
                                    placeholder="Motivo de la cortesía (obligatorio)"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">PIN gerente / cajera</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={cortesiaModalPin}
                                    onChange={e => { setCortesiaModalPin(e.target.value); setCortesiaModalError(''); }}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-center tracking-widest focus:border-purple-500 focus:outline-none"
                                    placeholder="••••••"
                                />
                                {cortesiaModalError && <p className="text-red-400 text-xs mt-1">{cortesiaModalError}</p>}
                            </div>
                        </div>
                        <div className="border-t border-slate-800 p-4 flex gap-3">
                            <button type="button" onClick={() => setShowCortesiaModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold text-sm">Cancelar</button>
                            <button
                                type="button"
                                onClick={handleCortesiaModalConfirm}
                                disabled={isProcessing}
                                className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-black text-sm disabled:opacity-50"
                            >
                                {isProcessing ? '...' : '✓ Aplicar cortesía'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODAL: PIN CAJERA — REGISTRAR PAGO                               */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showPaymentPinModal && activeTab && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="border-b border-slate-800 p-5 flex items-center justify-between">
                            <h3 className="text-lg font-black">🔐 Autorizar cobro</h3>
                            <button onClick={() => setShowPaymentPinModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-800 rounded-xl p-3 text-sm space-y-1">
                                <div className="flex justify-between"><span className="text-slate-400">Método:</span><span className="font-bold">{PAYMENT_LABELS[paymentMethod]}</span></div>
                                {discountType === 'DIVISAS_33' && activeTab && (
                                    <div className="flex justify-between text-blue-400 text-xs"><span>Descuento -33.33%:</span><span>-${(activeTab.balanceDue / 3).toFixed(2)}</span></div>
                                )}
                                {discountType === 'CORTESIA_PERCENT' && activeTab && (
                                    <div className="flex justify-between text-purple-400 text-xs"><span>Cortesía {cortesiaPctClamped}%:</span><span>-${(activeTab.balanceDue * (cortesiaPctClamped / 100)).toFixed(2)}</span></div>
                                )}
                                <div className="flex justify-between"><span className="text-slate-400">Monto:</span><span className="font-black text-emerald-400 text-base">${paidAmount.toFixed(2)}</span></div>
                                {exchangeRate && <div className="flex justify-between text-slate-500 text-xs"><span>Equivalente Bs:</span><span>Bs. {(paidAmount * exchangeRate).toFixed(2)}</span></div>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">PIN de cajera / gerente</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={paymentPin}
                                    onChange={e => { setPaymentPin(e.target.value); setPaymentPinError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handlePaymentPinConfirm()}
                                    placeholder="••••••"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-3 text-white text-center text-xl tracking-widest focus:border-amber-500 focus:outline-none"
                                />
                                {paymentPinError && <p className="text-red-400 text-xs mt-1">{paymentPinError}</p>}
                            </div>
                        </div>
                        <div className="border-t border-slate-800 p-4 flex gap-3">
                            <button onClick={() => setShowPaymentPinModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold text-sm">Cancelar</button>
                            <button
                                onClick={handlePaymentPinConfirm}
                                disabled={!paymentPin || isProcessing}
                                className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm transition disabled:opacity-50"
                            >
                                {isProcessing ? 'Procesando...' : '✓ Confirmar pago'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODAL: CUENTA CERRADA — IMPRIMIR FACTURA                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {closedTabForPrint && (
                <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
                    <div className="bg-white text-black w-full max-w-md rounded-2xl p-8 text-center shadow-2xl">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-5xl">✅</span>
                        </div>
                        <h2 className="text-3xl font-black mb-2 text-gray-900">¡Cuenta cerrada!</h2>
                        <p className="text-xl text-gray-600 mb-8">{closedTabForPrint.tabCode} · ${closedTabForPrint.runningTotal.toFixed(2)}</p>
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    const tab = closedTabForPrint;
                                    const invoiceOrder = tab.orders.find((o: any) => o.orderNumber?.startsWith('REST-'));
                                    const items = (invoiceOrder ? invoiceOrder.items : tab.orders.flatMap((o: any) => o.items)).map((i: any) => ({
                                        name: i.itemName,
                                        quantity: i.quantity,
                                        unitPrice: i.lineTotal / i.quantity,
                                        total: i.lineTotal,
                                        modifiers: (i.modifiers || []).map((m: { name: string }) => m.name),
                                        notes: undefined
                                    }));
                                    const total = tab.runningTotal;
                                    printReceipt({
                                        orderNumber: invoiceOrder?.orderNumber || tab.orders[0]?.orderNumber || tab.tabCode,
                                        orderType: 'RESTAURANT',
                                        date: new Date(),
                                        cashierName: 'Cajero',
                                        customerName: tab.customerLabel || 'Mesa',
                                        items,
                                        subtotal: total,
                                        discount: 0,
                                        total,
                                    });
                                }}
                                className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg"
                            >
                                <span>🖨️</span> IMPRIMIR FACTURA
                            </button>
                            <button
                                onClick={() => { setClosedTabForPrint(null); setSelectedTableId(''); }}
                                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold text-lg border-2 border-gray-200"
                            >
                                Nueva cuenta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODAL: ELIMINAR ITEM (PIN + JUSTIFICACIÓN)                       */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showRemoveModal && removeTarget && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-900/50 rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="border-b border-slate-800 p-5 flex items-center justify-between">
                            <h3 className="text-lg font-black text-red-400">🗑️ Eliminar item</h3>
                            <button onClick={() => setShowRemoveModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 text-sm">
                                <div className="font-bold text-white">{removeTarget.qty}× {removeTarget.itemName}</div>
                                <div className="text-red-400 font-black">−${removeTarget.lineTotal.toFixed(2)}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Justificación <span className="text-red-400">*</span></label>
                                <textarea
                                    value={removeJustification}
                                    onChange={e => { setRemoveJustification(e.target.value); setRemoveError(''); }}
                                    placeholder="Ej: Error de pedido, cliente cambió de opinión..."
                                    rows={2}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm resize-none focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">PIN de cajera / gerente <span className="text-red-400">*</span></label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={removePin}
                                    onChange={e => { setRemovePin(e.target.value); setRemoveError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleRemoveItem()}
                                    placeholder="••••••"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-3 text-white text-center text-xl tracking-widest focus:border-red-500 focus:outline-none"
                                />
                                {removeError && <p className="text-red-400 text-xs mt-1">{removeError}</p>}
                            </div>
                        </div>
                        <div className="border-t border-slate-800 p-4 flex gap-3">
                            <button onClick={() => setShowRemoveModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold text-sm">Cancelar</button>
                            <button
                                onClick={handleRemoveItem}
                                disabled={!removePin || !removeJustification.trim() || isProcessing}
                                className="flex-[2] py-3 bg-red-700 hover:bg-red-600 rounded-xl font-black text-sm transition disabled:opacity-50"
                            >
                                {isProcessing ? 'Eliminando...' : 'Eliminar item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODAL: MODIFICADORES                                              */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showModifierModal && selectedItemForModifier && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900">
                        <div className="border-b border-slate-800 p-5 flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-black">{selectedItemForModifier.name}</h3>
                                <p className="mt-1 text-lg font-bold text-amber-400">${selectedItemForModifier.price.toFixed(2)}</p>
                            </div>
                            <button onClick={() => setShowModifierModal(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="space-y-5 p-5">
                            {selectedItemForModifier.modifierGroups.map(gr => {
                                const group = gr.modifierGroup;
                                const totalSel = currentModifiers.filter(m => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0);
                                return (
                                    <div key={group.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-bold">{group.name}{group.isRequired && <span className="text-red-400 ml-1 text-xs">*</span>}</span>
                                            <span className="text-xs text-slate-400">{totalSel}/{group.maxSelections}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {group.modifiers.filter(m => m.isAvailable).map(modifier => {
                                                const sel = currentModifiers.find(m => m.id === modifier.id && m.groupId === group.id);
                                                const qty = sel?.quantity || 0;
                                                const isRadio = group.maxSelections === 1;
                                                return (
                                                    <div key={modifier.id} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2">
                                                        <div>
                                                            <div className="text-sm font-medium">{modifier.name}</div>
                                                            {modifier.priceAdjustment !== 0 && <div className="text-xs text-slate-400">+${modifier.priceAdjustment.toFixed(2)}</div>}
                                                        </div>
                                                        {isRadio ? (
                                                            <button onClick={() => updateModifierQuantity(group, modifier, 1)} className={`h-7 w-7 rounded-full border text-sm ${qty > 0 ? 'border-amber-500 bg-amber-500 text-black' : 'border-slate-500'}`}>
                                                                {qty > 0 ? '✓' : ''}
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => updateModifierQuantity(group, modifier, -1)} className="h-8 w-8 rounded-lg bg-slate-700 font-bold">−</button>
                                                                <span className="w-5 text-center font-black text-amber-400">{qty}</span>
                                                                <button onClick={() => updateModifierQuantity(group, modifier, 1)} className="h-8 w-8 rounded-lg bg-amber-600 font-bold">+</button>
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
                                <label className="block text-xs font-bold text-slate-400 mb-2">Notas</label>
                                <textarea
                                    value={itemNotes}
                                    onChange={e => setItemNotes(e.target.value)}
                                    className="h-16 w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                                    placeholder="Sin hielo, extra limón..."
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4">
                                <span className="font-bold">Cantidad</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="h-10 w-10 rounded-full bg-slate-700 font-bold text-xl">−</button>
                                    <span className="w-8 text-center text-xl font-black">{itemQuantity}</span>
                                    <button onClick={() => setItemQuantity(itemQuantity + 1)} className="h-10 w-10 rounded-full bg-amber-600 font-bold text-xl">+</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 border-t border-slate-800 p-5">
                            <button onClick={() => setShowModifierModal(false)} className="flex-1 rounded-xl bg-slate-700 py-3 font-bold">Cancelar</button>
                            <button
                                onClick={confirmAddToCart}
                                disabled={selectedItemForModifier.modifierGroups.some(g => !isGroupValid(g.modifierGroup))}
                                className="flex-[2] rounded-xl bg-amber-600 hover:bg-amber-500 py-3 font-black transition disabled:opacity-50"
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