"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  addItemsToOpenTabAction,
  closeOpenTabAction,
  getMenuForPOSAction,
  getRestaurantLayoutAction,
  getUsersForTabAction,
  openTabAction,
  registerOpenTabPaymentAction,
  createSalesOrderAction,
  removeItemFromOpenTabAction,
  validateManagerPinAction,
  type CartItem,
} from "@/app/actions/pos.actions";
import { incrementPreBillPrintAction } from "@/app/actions/prebill.actions";
import { closeZeroBalanceTabAction } from "@/app/actions/subtab.actions";
import { getActiveCashSessionAction, openCashSessionAction } from "@/app/actions/cash-session.actions";
import { SplitTabModal } from "./SplitTabModal";
import { getExchangeRateValue } from "@/app/actions/exchange.actions";
import { printKitchenCommand, printReceipt } from "@/lib/print-command";
import { getPOSConfig } from "@/lib/pos-settings";
import { PriceDisplay } from "@/components/pos/PriceDisplay";
import { CurrencyCalculator } from "@/components/pos/CurrencyCalculator";
import { CashierShiftModal } from "@/components/pos/CashierShiftModal";

// ============================================================================
// TIPOS
// ============================================================================

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
  modifierGroups: { modifierGroup: ModifierGroup }[];
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
interface OrderItemSummary {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: { name: string }[];
}
interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  total: number;
  kitchenStatus: string;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string };
  items: OrderItemSummary[];
}
interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}
interface OpenTabSummary {
  id: string;
  tabCode: string;
  customerLabel?: string;
  customerPhone?: string;
  guestCount: number;
  status: string;
  runningTotal: number;
  balanceDue: number;
  openedAt: string;
  openedBy: UserSummary;
  assignedWaiter?: UserSummary | null;
  closedBy?: UserSummary | null;
  orders: SalesOrderSummary[];
  paymentSplits: PaymentSplit[];
  preBillPrintCount?: number;
  parentTabId?: string | null;
  splitIndex?: number | null;
}
interface TableSummary {
  id: string;
  name: string;
  code: string;
  stationType: string;
  capacity: number;
  currentStatus: string;
  openTabs: OpenTabSummary[];
}
interface ZoneSummary {
  id: string;
  name: string;
  zoneType: string;
  tablesOrStations: TableSummary[];
}
interface SportBarLayout {
  id: string;
  name: string;
  serviceZones: ZoneSummary[];
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "💵 Efectivo $",
  CASH_BS: "🇻🇪 Efectivo Bs",
  CARD: "💳 Tarjeta",
  MOBILE_PAY: "📱 Pago Móvil",
  TRANSFER: "🏦 Transferencia",
  ZELLE: "⚡ Zelle",
};
const CASHIER_ROLES = ["OWNER", "ADMIN_MANAGER", "OPS_MANAGER", "AREA_LEAD"];

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    OWNER: "Dueño",
    ADMIN_MANAGER: "Gerente Adm.",
    OPS_MANAGER: "Gerente Ops.",
    AREA_LEAD: "Cajera/Líder",
    CHEF: "Cocina",
  };
  return map[role] || role;
}

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Caracas" });
}
function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function POSSportBarPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [layout, setLayout] = useState<SportBarLayout | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // ── Zone / Table / Tab selection ──────────────────────────────────────────
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");

  // ── Open tab form (modal) ─────────────────────────────────────────────────
  const [showOpenTabModal, setShowOpenTabModal] = useState(false);
  const [openTabName, setOpenTabName] = useState("");
  const [openTabPhone, setOpenTabPhone] = useState("");
  const [openTabGuests, setOpenTabGuests] = useState(2);
  const [openTabWaiter, setOpenTabWaiter] = useState("");

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CASH_BS" | "CARD" | "TRANSFER" | "MOBILE_PAY" | "ZELLE">("CASH");
  const [amountReceived, setAmountReceived] = useState("");
  const [showPaymentPinModal, setShowPaymentPinModal] = useState(false);
  const [paymentPin, setPaymentPin] = useState("");
  const [paymentPinError, setPaymentPinError] = useState("");
  const [paymentLines, setPaymentLines] = useState<{ method: "CASH" | "CASH_BS" | "CARD" | "TRANSFER" | "MOBILE_PAY" | "ZELLE"; amount: string }[]>([]);
  const [useMultiPayment, setUseMultiPayment] = useState(false);

  // ── Descuento ─────────────────────────────────────────────────────────────
  const [discountType, setDiscountType] = useState<"NONE" | "DIVISAS_33" | "CORTESIA_100" | "CORTESIA_PERCENT">("NONE");
  const [authorizedManager, setAuthorizedManager] = useState<{ id: string; name: string } | null>(null);
  const [showCortesiaModal, setShowCortesiaModal] = useState(false);
  const [cortesiaPin, setCortesiaPin] = useState("");
  const [cortesiaPercent, setCortesiaPercent] = useState("100");
  const [cortesiaPinError, setCortesiaPinError] = useState("");
  const [cortesiaReason, setCortesiaReason] = useState("");
  // WA report data after a cortesía payment
  const [cortesiaReportData, setCortesiaReportData] = useState<{
    tabCode: string;
    customerLabel?: string;
    items: { name: string; quantity: number; total: number }[];
    totalOriginal: number;
    discountPercent: number;
    discountAmount: number;
    totalCharged: number;
    authorizedBy?: string;
    reason: string;
    date: Date;
  } | null>(null);

  // ── 10% Servicio (solo sala principal, opcional) ───────────────────────────
  const [serviceFeeIncluded, setServiceFeeIncluded] = useState(true);

  // ── Remove item ───────────────────────────────────────────────────────────
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    orderId: string;
    itemId: string;
    itemName: string;
    qty: number;
    lineTotal: number;
  } | null>(null);
  const [removePin, setRemovePin] = useState("");
  const [removeJustification, setRemoveJustification] = useState("");
  const [removeError, setRemoveError] = useState("");

  // ── Modifier modal ────────────────────────────────────────────────────────
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
  const [currentModifiers, setCurrentModifiers] = useState<SelectedModifier[]>([]);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");

  // ── State flags ───────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [layoutError, setLayoutError] = useState("");

  const [mobileTab, setMobileTab] = useState<"tables" | "menu" | "account">("tables");
  const cartBadgeCount = cart.length;

  // ── Nueva Funcionalidad: Cajero y Pickup ──────────────────────────────────
  const [cashierName, setCashierName] = useState("");
  const [showChangeCashierModal, setShowChangeCashierModal] = useState(false);
  const [isPickupMode, setIsPickupMode] = useState(false);
  const [pickupCustomerName, setPickupCustomerName] = useState("");
  const [lastPickupOrder, setLastPickupOrder] = useState<{
    orderNumber: string;
    total: number;
    subtotal: number;
    discount: number;
    items: { name: string; quantity: number; unitPrice: number; total: number; modifiers: string[] }[];
    customerName: string;
  } | null>(null);
  // Auto-clear lastPickupOrder after 60s so it doesn't linger between customers
  const lastPickupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Anti-fraude: Divisas lock ─────────────────────────────────────────────
  // Una vez seleccionado "Divisas -33%", cambiar el método de pago requiere PIN.
  const [isDivisasLocked, setIsDivisasLocked] = useState(false);
  const [showDivisasUnlockModal, setShowDivisasUnlockModal] = useState(false);
  const [divisasUnlockPin, setDivisasUnlockPin] = useState("");
  const [divisasUnlockError, setDivisasUnlockError] = useState("");
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(null);

  // ── Subcuentas (Split Bills) ──────────────────────────────────────────────
  const [selectedSubTabId, setSelectedSubTabId] = useState<string | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);

  // ── Sesión de caja ────────────────────────────────────────────────────────
  const [cashSession, setCashSession] = useState<any>(null);
  const [cashSessionLoaded, setCashSessionLoaded] = useState(false);
  const [isOpeningCash, setIsOpeningCash] = useState(false);

  // ── Pre-bill print count (local, synced con servidor) ─────────────────────
  const [localPreBillCount, setLocalPreBillCount] = useState(0);
  const [preBillWAAlert, setPreBillWAAlert] = useState<{
    tabCode: string; balance: number; count: number; tableName?: string;
  } | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = async () => {
    setIsLoading(true);
    setLayoutError("");
    try {
      const [menuResult, layoutResult, usersResult, rate, session] = await Promise.all([
        getMenuForPOSAction(),
        getRestaurantLayoutAction(),
        getUsersForTabAction(),
        getExchangeRateValue(),
        getActiveCashSessionAction(),
      ]);
      setCashSession(session);
      setCashSessionLoaded(true);
      if (menuResult.success && menuResult.data) {
        setCategories(menuResult.data);
        setSelectedCategory((prev) => prev || menuResult.data[0]?.id || "");
      }
      if (layoutResult.success && layoutResult.data) {
        const nextLayout = layoutResult.data as SportBarLayout;
        setLayout(nextLayout);
        setSelectedZoneId((prev) => prev || nextLayout.serviceZones[0]?.id || "");
      } else if (!layoutResult.success) {
        setLayoutError(layoutResult.message || "Error cargando mesas");
      }
      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data);
      }
      setExchangeRate(rate);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-clear lastPickupOrder después de 60s para no "pegar" entre clientes
  useEffect(() => {
    if (lastPickupOrder) {
      if (lastPickupTimerRef.current) clearTimeout(lastPickupTimerRef.current);
      lastPickupTimerRef.current = setTimeout(() => setLastPickupOrder(null), 60_000);
    }
    return () => { if (lastPickupTimerRef.current) clearTimeout(lastPickupTimerRef.current); };
  }, [lastPickupOrder]);

  // Reset divisas lock, pre-bill count y subcuenta al cambiar de mesa
  useEffect(() => {
    setIsDivisasLocked(false);
    setLocalPreBillCount(0);
    setPreBillWAAlert(null);
    setSelectedSubTabId(null);
    setShowSplitModal(false);
  }, [selectedTableId]);

  useEffect(() => {
    if (paymentMethod !== "CASH" && paymentMethod !== "ZELLE" && discountType === "DIVISAS_33") {
      setDiscountType("NONE");
      setIsDivisasLocked(false); // Si el método ya no es divisas, liberar el lock
    }
  }, [paymentMethod, discountType]);

  useEffect(() => {
    if (!selectedCategory || !categories.length) return;
    const cat = categories.find((c) => c.id === selectedCategory);
    setMenuItems(cat?.items || []);
  }, [selectedCategory, categories]);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const selectedZone = useMemo(
    () => layout?.serviceZones.find((z) => z.id === selectedZoneId) || null,
    [layout, selectedZoneId],
  );

  const selectedTable = useMemo(
    () => selectedZone?.tablesOrStations.find((t) => t.id === selectedTableId) || null,
    [selectedZone, selectedTableId],
  );

  // Cuenta padre: la que NO tiene parentTabId
  const parentTab = useMemo(
    () => (selectedTable?.openTabs || []).find(t => !t.parentTabId) || null,
    [selectedTable],
  );

  // Subcuentas de la cuenta padre activa (o subcuentas huérfanas si el padre fue cerrado)
  const tabSubTabs = useMemo(() => {
    const tabs = selectedTable?.openTabs || [];
    if (parentTab) return tabs.filter(t => t.parentTabId === parentTab.id);
    // Subcuentas huérfanas: padre cerrado pero subcuenta aún abierta
    return tabs.filter(t => t.parentTabId != null);
  }, [selectedTable, parentTab]);

  // Tab activa para pagos: la subcuenta seleccionada, la cuenta padre, o primera subcuenta huérfana
  const activeTab = useMemo(
    () => (selectedSubTabId ? tabSubTabs.find(t => t.id === selectedSubTabId) : null) || parentTab || tabSubTabs[0] || null,
    [parentTab, tabSubTabs, selectedSubTabId],
  );

  const allMenuItems = useMemo(
    () => categories.flatMap((c) => (c.items || [])),
    [categories],
  );

  const filteredMenuItems = useMemo(() => {
    if (!productSearch.trim()) return menuItems;
    const q = productSearch.toLowerCase();
    return allMenuItems.filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }, [menuItems, productSearch, allMenuItems]);

  const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const paidAmount = parseFloat(amountReceived) || 0;
  const isPagoDivisas = paymentMethod === "CASH" || paymentMethod === "ZELLE";

  const cortesiaPercentNum = Math.min(100, Math.max(0, parseFloat(cortesiaPercent) || 0));

  const paymentBaseAmount = activeTab
    ? discountType === "DIVISAS_33"
      ? (activeTab.balanceDue * 2) / 3
      : discountType === "CORTESIA_100"
      ? 0
      : discountType === "CORTESIA_PERCENT"
      ? activeTab.balanceDue * (1 - cortesiaPercentNum / 100)
      : activeTab.balanceDue
    : 0;
  const paymentAmountToCharge = serviceFeeIncluded ? paymentBaseAmount * 1.1 : paymentBaseAmount;

  // Pickup totals (extracted for reuse)
  const pickupDiscount = discountType === "DIVISAS_33" ? cartTotal / 3
    : discountType === "CORTESIA_100" ? cartTotal
    : discountType === "CORTESIA_PERCENT" ? cartTotal * (cortesiaPercentNum / 100)
    : 0;
  const pickupTotal = Math.max(0, cartTotal - pickupDiscount);

  // Pago mixto
  const DIVISAS_METHODS_SET = new Set(["CASH", "ZELLE"]);
  const multiTotal = paymentLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  // Descuento divisas parcial: solo las líneas CASH/ZELLE generan el 33% de descuento
  // La lógica: $X pagado en divisas cubre $X / (2/3) = $X * 1.5 del saldo, ahorrando $X * 0.5
  const mixedDivisasPayments = paymentLines
    .filter(l => DIVISAS_METHODS_SET.has(l.method))
    .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const mixedDivisasDiscount = mixedDivisasPayments * 0.5; // = descuento = divisas_pagado / 2

  // Tab: base es paymentBaseAmount (ya descuenta cortesía si la hay)
  const mixedTabBase = Math.max(0, paymentBaseAmount - mixedDivisasDiscount);
  const mixedTabTotal = mixedTabBase * (serviceFeeIncluded ? 1.1 : 1);
  const multiTabRemaining = mixedTabTotal - multiTotal;
  const multiTabValid = useMultiPayment
    ? paymentLines.filter(l => parseFloat(l.amount) > 0).length > 1 && multiTotal >= mixedTabTotal - 0.001
    : true;

  // Pickup: base es pickupTotal (ya descuenta cortesía si la hay)
  const mixedPickupBase = Math.max(0, pickupTotal - mixedDivisasDiscount);
  const multiPickupRemaining = mixedPickupBase - multiTotal;
  const multiPickupValid = useMultiPayment
    ? paymentLines.filter(l => parseFloat(l.amount) > 0).length > 1 && multiTotal >= mixedPickupBase - 0.001
    : true;

  // ============================================================================
  // OPEN TAB
  // ============================================================================

  const handleOpenTab = async () => {
    if (!selectedTable) return;
    if (!openTabName.trim()) {
      alert("El nombre del cliente es obligatorio");
      return;
    }
    if (!openTabPhone.trim()) {
      alert("El teléfono del cliente es obligatorio");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await openTabAction({
        tableOrStationId: selectedTable.id,
        customerLabel: openTabName.trim(),
        customerPhone: openTabPhone.trim(),
        guestCount: openTabGuests,
        waiterLabel: openTabWaiter ? `Mesonero ${openTabWaiter}` : undefined,
      });
      if (!result.success) {
        alert(result.message);
        return;
      }
      setShowOpenTabModal(false);
      setOpenTabName("");
      setOpenTabPhone("");
      setOpenTabGuests(2);
      setOpenTabWaiter("");
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // CART & MODIFIERS
  // ============================================================================

  const handleAddToCart = (item: MenuItem) => {
    if (!activeTab && !isPickupMode) return;
    setSelectedItemForModifier(item);
    setCurrentModifiers([]);
    setItemQuantity(1);
    setItemNotes("");
    setShowModifierModal(true);
  };

  const updateModifierQuantity = (group: ModifierGroup, modifier: ModifierOption, change: number) => {
    const currentInGroup = currentModifiers.filter((m) => m.groupId === group.id);
    const totalSelected = currentInGroup.reduce((s, m) => s + m.quantity, 0);
    const existing = currentModifiers.find((m) => m.id === modifier.id && m.groupId === group.id);
    const currentQty = existing?.quantity || 0;

    if (change > 0) {
      if (group.maxSelections > 1 && totalSelected >= group.maxSelections) return;
      if (group.maxSelections === 1) {
        const others = currentModifiers.filter((m) => m.groupId !== group.id);
        setCurrentModifiers([
          ...others,
          {
            groupId: group.id,
            groupName: group.name,
            id: modifier.id,
            name: modifier.name,
            priceAdjustment: modifier.priceAdjustment,
            quantity: 1,
          },
        ]);
        return;
      }
    }
    const newQty = currentQty + change;
    if (newQty < 0) return;
    let mods = [...currentModifiers];
    if (existing) {
      mods =
        newQty === 0
          ? mods.filter((m) => !(m.id === modifier.id && m.groupId === group.id))
          : mods.map((m) => (m.id === modifier.id && m.groupId === group.id ? { ...m, quantity: newQty } : m));
    } else if (newQty > 0) {
      mods.push({
        groupId: group.id,
        groupName: group.name,
        id: modifier.id,
        name: modifier.name,
        priceAdjustment: modifier.priceAdjustment,
        quantity: newQty,
      });
    }
    setCurrentModifiers(mods);
  };

  const isGroupValid = (group: ModifierGroup) => {
    if (!group.isRequired) return true;
    return (
      currentModifiers.filter((m) => m.groupId === group.id).reduce((s, m) => s + m.quantity, 0) >= group.minSelections
    );
  };

  const confirmAddToCart = () => {
    if (!selectedItemForModifier) return;
    if (!selectedItemForModifier.modifierGroups.every((g) => isGroupValid(g.modifierGroup))) return;
    const modTotal = currentModifiers.reduce((s, m) => s + m.priceAdjustment * m.quantity, 0);
    const lineTotal = (selectedItemForModifier.price + modTotal) * itemQuantity;
    const exploded = currentModifiers.flatMap((m) =>
      Array(m.quantity).fill({ modifierId: m.id, name: m.name, priceAdjustment: m.priceAdjustment }),
    );
    setCart((prev) => [
      ...prev,
      {
        menuItemId: selectedItemForModifier.id,
        name: selectedItemForModifier.name,
        quantity: itemQuantity,
        unitPrice: selectedItemForModifier.price,
        modifiers: exploded,
        notes: itemNotes || undefined,
        lineTotal,
      },
    ]);
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
      if (!result.success) {
        alert(result.message);
        return;
      }
      if (result.data?.kitchenStatus === "SENT" && getPOSConfig().printComandaOnRestaurant) {
        printKitchenCommand({
          orderNumber: result.data.orderNumber,
          orderType: "RESTAURANT",
          customerName: activeTab.customerLabel || selectedTable?.name,
          items: cart.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            modifiers: i.modifiers.map((m) => m.name),
            notes: i.notes,
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

  // ============================================================================
  // CORTESIA AUTH
  // ============================================================================

  const openCortesiaModal = () => {
    setCortesiaPin("");
    setCortesiaPinError("");
    setCortesiaPercent("100");
    setShowCortesiaModal(true);
  };

  const handleCortesiaPinKey = (k: string) => {
    if (k === "clear") setCortesiaPin("");
    else if (k === "back") setCortesiaPin((p) => p.slice(0, -1));
    else setCortesiaPin((p) => p + k);
  };

  const handleCortesiaPinConfirm = async () => {
    setCortesiaPinError("");
    const r = await validateManagerPinAction(cortesiaPin);
    if (r.success && r.data) {
      setAuthorizedManager({ id: r.data.managerId, name: r.data.managerName });
      const pct = parseFloat(cortesiaPercent);
      if (pct >= 100) {
        setDiscountType("CORTESIA_100");
      } else {
        setDiscountType("CORTESIA_PERCENT");
      }
      setShowCortesiaModal(false);
    } else {
      setCortesiaPinError("PIN inválido");
    }
  };

  // ── Estado de Cuenta (pre-bill) ───────────────────────────────────────────
  const handlePrintEstadoDeCuenta = async () => {
    if (!activeTab) return;

    // 1. Registrar en servidor + obtener nuevo conteo
    const res = await incrementPreBillPrintAction(activeTab.id);
    const newCount = res.success ? res.count : localPreBillCount + 1;
    setLocalPreBillCount(newCount);

    // 2. Si > 2 impresiones, preparar alerta WA (se muestra en el banner)
    if (newCount > 2) {
      setPreBillWAAlert({
        tabCode: activeTab.tabCode,
        balance: activeTab.balanceDue,
        count: newCount,
        tableName: res.success ? res.tableName : undefined,
      });
    }

    // 3. Calcular ambos totales
    const totalNormal = activeTab.balanceDue;
    const totalDivisas = totalNormal * (2 / 3);
    const descuentoDivisas = totalNormal / 3;

    // 4. Imprimir estado de cuenta en ventana emergente
    const allItems = activeTab.orders.flatMap(o =>
      (o.items || []).map((i: any) => `<tr><td>${i.quantity}× ${i.itemName}</td><td style="text-align:right">$${(i.lineTotal || 0).toFixed(2)}</td></tr>`)
    ).join('');

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Estado de Cuenta</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 16px; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .no-factura { background: #000; color: #fff; font-weight: bold; font-size: 11px; text-align: center; padding: 4px; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 4px; }
        .total-row { border-top: 1px solid #000; font-weight: bold; }
        .divisas-box { border: 2px solid #000; padding: 8px; margin-top: 12px; }
        @media print { button { display: none; } }
      </style></head><body>
      <div class="header">
        <div style="font-size:16px;font-weight:bold">TABLE PONG</div>
        <div>Mesa: ${activeTab.tabCode}</div>
        <div>${activeTab.customerLabel || ''}</div>
        <div>${new Date().toLocaleString('es-VE')}</div>
      </div>
      <div class="no-factura">★ ESTADO DE CUENTA — NO VÁLIDO COMO FACTURA ★</div>
      <table>${allItems}
        <tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${totalNormal.toFixed(2)}</td></tr>
      </table>
      <div class="divisas-box">
        <div style="font-weight:bold;margin-bottom:4px">Pago en Divisas (USD/Zelle):</div>
        <table>
          <tr><td>Descuento -33.33%</td><td style="text-align:right">-$${descuentoDivisas.toFixed(2)}</td></tr>
          <tr class="total-row"><td>TOTAL CON DIVISAS</td><td style="text-align:right;font-size:14px;font-weight:bold">$${totalDivisas.toFixed(2)}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:10px">Impresión #${newCount}${newCount > 2 ? ' ⚠️ MÚLTIPLES COPIAS' : ''}</div>
      <div style="text-align:center;margin-top:16px"><button onclick="window.print();window.close()">🖨️ Imprimir</button></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // ── Cambio de método de pago con lock divisas ─────────────────────────────
  const handleChangePaymentMethod = (method: string) => {
    if (isDivisasLocked && discountType === "DIVISAS_33") {
      // Divisas activo y bloqueado → requerir PIN antes de cambiar
      setPendingPaymentMethod(method);
      setDivisasUnlockPin("");
      setDivisasUnlockError("");
      setShowDivisasUnlockModal(true);
    } else {
      setPaymentMethod(method as any);
    }
  };

  const handleDivisasUnlockConfirm = async () => {
    const res = await validateManagerPinAction(divisasUnlockPin);
    if (!res.success) {
      setDivisasUnlockError("PIN incorrecto");
      return;
    }
    // Autorizado: cambiar método y limpiar descuento divisas
    if (pendingPaymentMethod) setPaymentMethod(pendingPaymentMethod as any);
    setDiscountType("NONE");
    setIsDivisasLocked(false);
    setShowDivisasUnlockModal(false);
    setPendingPaymentMethod(null);
  };

  const clearDiscount = () => {
    setDiscountType("NONE");
    setIsDivisasLocked(false);
    setAuthorizedManager(null);
    setCortesiaPercent("100");
    setCortesiaReason("");
  };

  // ============================================================================
  // PAYMENT (requiere PIN de cajera)
  // ============================================================================

  const handlePaymentPinConfirm = async () => {
    if (!activeTab) return;
    if (useMultiPayment) {
      if (!multiTabValid || paymentLines.filter(l => parseFloat(l.amount) > 0).length < 2) {
        setPaymentPinError("Pago mixto: asigne al menos 2 métodos y cubra el total");
        return;
      }
    } else if (paidAmount <= 0 && discountType !== "CORTESIA_100" && !(discountType === "CORTESIA_PERCENT" && cortesiaPercentNum >= 100)) {
      // Allow $0 when it's a full cortesía (100% discount closes tab without payment)
      return;
    }
    setPaymentPinError("");
    setIsProcessing(true);
    try {
      const pinResult = await validateManagerPinAction(paymentPin);
      if (!pinResult.success) {
        setPaymentPinError("PIN incorrecto o sin permisos de cajera");
        return;
      }
      let discountAmount = 0;
      let discountLabel = "";
      if (discountType === "DIVISAS_33") {
        discountAmount = activeTab.balanceDue / 3;
        discountLabel = " · -33.33% Divisas";
      } else if (discountType === "CORTESIA_100") {
        discountAmount = activeTab.balanceDue;
        discountLabel = " · Cortesía 100%";
      } else if (discountType === "CORTESIA_PERCENT") {
        discountAmount = activeTab.balanceDue * (cortesiaPercentNum / 100);
        discountLabel = ` · Cortesía ${cortesiaPercentNum}%`;
      }
      let result;
      if (useMultiPayment && paymentLines.filter(l => parseFloat(l.amount) > 0).length > 1) {
        const splits = paymentLines.filter(l => parseFloat(l.amount) > 0).map(l => ({ method: l.method as any, amount: parseFloat(l.amount) }));
        // Descuento total = cortesía (si aplica) + divisas parciales de las líneas CASH/ZELLE
        const partialDivisasDiscount = splits
          .filter(s => DIVISAS_METHODS_SET.has(s.method))
          .reduce((sum, s) => sum + s.amount * 0.5, 0);
        const totalDiscount = discountAmount + partialDivisasDiscount;
        result = await registerOpenTabPaymentAction({
          openTabId: activeTab.id,
          amount: 0,
          paymentMethod: "CASH",
          paymentSplits: splits,
          discountAmount: totalDiscount > 0 ? totalDiscount : undefined,
        });
      } else {
        result = await registerOpenTabPaymentAction({
          openTabId: activeTab.id,
          amount: paidAmount,
          paymentMethod,
          splitLabel: `${PAYMENT_LABELS[paymentMethod] || paymentMethod}${discountLabel} – ${pinResult.data?.managerName || ""}`,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          includeServiceCharge: serviceFeeIncluded,
        });
      }
      if (!result.success) {
        alert(result.message);
        return;
      }
      // Imprimir factura: correlativo fijo por mesa (tabCode), 10% servicio solo si el cliente lo pagó
      const subtotal = (activeTab as any).runningSubtotal ?? activeTab.orders.reduce((s, o) => s + o.items.reduce((si: number, i: any) => si + (i.lineTotal || 0), 0), 0);
      const discount = discountAmount > 0 ? discountAmount : ((activeTab as any).runningDiscount ?? 0);
      const totalAntesServicio = Math.max(0, activeTab.balanceDue - discountAmount);
      const serviceFee = serviceFeeIncluded ? totalAntesServicio * 0.1 : 0;
      const allItems = activeTab.orders.flatMap((o) =>
        (o.items || []).map((i: any) => ({
          name: i.itemName,
          quantity: i.quantity,
          unitPrice: (i.lineTotal || 0) / (i.quantity || 1),
          total: i.lineTotal || 0,
          modifiers: (i.modifiers || []).map((m: any) => m.name),
        }))
      );
      if (getPOSConfig().printReceiptOnRestaurant) {
      printReceipt({
        orderNumber: activeTab.tabCode,
        orderType: "RESTAURANT",
        date: new Date(),
        cashierName: cashierName || pinResult.data?.managerName || "Cajera",
        customerName: activeTab.customerLabel,
        items: allItems,
        subtotal,
        discount,
        discountReason: discountType === "DIVISAS_33" ? "Descuento aplicado" : undefined,
        total: totalAntesServicio,
        serviceFee,
      });
      }
      // Capture WA report data before clearing state (cortesía only)
      if (discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") {
        const reportItems = allItems.map(i => ({ name: i.name, quantity: i.quantity, total: i.total }));
        const pctNum = discountType === "CORTESIA_100" ? 100 : cortesiaPercentNum;
        const origTotal = activeTab.balanceDue;
        setCortesiaReportData({
          tabCode: activeTab.tabCode,
          customerLabel: activeTab.customerLabel,
          items: reportItems,
          totalOriginal: origTotal,
          discountPercent: pctNum,
          discountAmount,
          totalCharged: Math.max(0, origTotal - discountAmount),
          authorizedBy: pinResult.data?.managerName || authorizedManager?.name,
          reason: cortesiaReason,
          date: new Date(),
        });
      }
      setAmountReceived("");
      setPaymentPin("");
      clearDiscount();
      setServiceFeeIncluded(true);
      setUseMultiPayment(false);
      setPaymentLines([]);
      setShowPaymentPinModal(false);
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseTab = async () => {
    if (!activeTab) return;
    const balance = Number(activeTab.balanceDue ?? 0);
    if (balance > 0.01) {
      alert("La cuenta aún tiene saldo pendiente");
      return;
    }
    if (!confirm("¿Cerrar esta cuenta?")) return;
    setIsProcessing(true);
    try {
      const result = await closeOpenTabAction(activeTab.id);
      if (!result.success) {
        alert(result.message);
        return;
      }
      await loadData();
      setSelectedTableId("");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // CHECKOUT PICKUP
  // ============================================================================

  const handleCheckoutPickup = async () => {
    if (cart.length === 0) return;
    if (useMultiPayment) {
      const validLines = paymentLines.filter(l => parseFloat(l.amount) > 0);
      if (validLines.length < 2 || multiTotal < pickupTotal - 0.001) {
        alert("Pago mixto: asigne al menos 2 métodos y cubra el total");
        return;
      }
    }
    setIsProcessing(true);
    try {
      const finalTotal = pickupTotal;

      const pickupSplits = useMultiPayment ? paymentLines.filter(l => parseFloat(l.amount) > 0).map(l => ({ method: l.method as any, amount: parseFloat(l.amount) })) : undefined;
      // Descuento divisas parciales: solo aplica si hay líneas CASH/ZELLE en pago mixto
      const pickupPartialDivisasDiscount = pickupSplits
        ? pickupSplits.filter(s => DIVISAS_METHODS_SET.has(s.method)).reduce((sum, s) => sum + s.amount * 0.5, 0)
        : 0;
      // Cortesía ya está capturada en discountType; se suma el descuento divisas si aplica
      const pickupHasDivisasLines = pickupPartialDivisasDiscount > 0;
      const result = await createSalesOrderAction({
        orderType: "RESTAURANT",
        customerName: pickupCustomerName || "Cliente en Caja",
        items: cart,
        paymentMethod: useMultiPayment ? "MULTIPLE" : paymentMethod,
        amountPaid: useMultiPayment ? multiTotal : (paidAmount || finalTotal),
        notes: "Venta Directa Pickup",
        discountType: pickupHasDivisasLines ? undefined : discountType,
        discountPercent: (!pickupHasDivisasLines && discountType === "CORTESIA_PERCENT") ? cortesiaPercentNum : undefined,
        authorizedById: authorizedManager?.id,
        paymentSplits: pickupSplits,
        // Descuento total: cortesía + divisas parciales
        discountAmountOverride: pickupHasDivisasLines ? pickupDiscount + pickupPartialDivisasDiscount : undefined,
        discountReasonOverride: pickupHasDivisasLines ? `Divisas parcial${pickupDiscount > 0 ? " + Cortesía" : ""}` : undefined,
      });

      if (result.success && result.data) {
        if (getPOSConfig().printComandaOnRestaurant) {
        printKitchenCommand({
          orderNumber: result.data.orderNumber,
          orderType: "RESTAURANT",
          customerName: pickupCustomerName || "Cliente Caja",
          items: cart.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            modifiers: i.modifiers.map((m) => m.name),
            notes: i.notes,
          })),
          createdAt: new Date(),
        });
        }
        const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
        const discount = pickupDiscount;
        const discountReason = discount > 0 ? "Descuento aplicado" : undefined;
        const pickupReceiptItems = cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.lineTotal,
          modifiers: i.modifiers.map((m) => m.name),
        }));
        const pickupReceiptData = {
          orderNumber: result.data.orderNumber,
          orderType: "RESTAURANT" as const,
          date: new Date(),
          cashierName: cashierName || "Cajera",
          customerName: pickupCustomerName || "Cliente en Caja",
          items: pickupReceiptItems,
          subtotal,
          discount,
          discountReason,
          total: finalTotal,
          serviceFee: 0,
        };
        if (getPOSConfig().printReceiptOnRestaurant) {
          printReceipt(pickupReceiptData);
        }
        setLastPickupOrder({
          orderNumber: result.data.orderNumber,
          total: finalTotal,
          subtotal,
          discount,
          items: pickupReceiptItems,
          customerName: pickupCustomerName || "Cliente en Caja",
        });

        setCart([]);
        setPaymentMethod("CASH");
        setAmountReceived("");
        clearDiscount();
        setUseMultiPayment(false);
        setPaymentLines([]);
        setPickupCustomerName("");
      } else {
        alert(result.message);
      }
    } catch (e) {
      console.error(e);
      alert("Error en Venta Directa");
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // REMOVE ITEM
  // ============================================================================

  const openRemoveModal = (orderId: string, item: OrderItemSummary) => {
    setRemoveTarget({
      orderId,
      itemId: item.id,
      itemName: item.itemName,
      qty: item.quantity,
      lineTotal: item.lineTotal,
    });
    setRemovePin("");
    setRemoveJustification("");
    setRemoveError("");
    setShowRemoveModal(true);
  };

  const handleRemoveItem = async () => {
    if (!removeTarget || !activeTab) return;
    if (!removeJustification.trim()) {
      setRemoveError("La justificación es obligatoria");
      return;
    }
    setIsProcessing(true);
    setRemoveError("");
    try {
      const result = await removeItemFromOpenTabAction({
        openTabId: activeTab.id,
        orderId: removeTarget.orderId,
        itemId: removeTarget.itemId,
        cashierPin: removePin,
        justification: removeJustification,
      });
      if (!result.success) {
        setRemoveError(result.message);
        return;
      }
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
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">🍸</div>
          <div className="text-xl font-bold">Cargando Restaurante...</div>
        </div>
      </div>
    );
  }

  const canOpenCash = user && ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'CASHIER_RESTAURANT', 'AREA_LEAD'].includes(user.role);

  if (cashSessionLoaded && !cashSession) {
    if (canOpenCash) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-card glass-panel w-full max-w-sm rounded-3xl p-8 space-y-6 text-center border border-border shadow-2xl">
            <div className="text-5xl">🔐</div>
            <div>
              <h2 className="text-xl font-black">La caja no está abierta</h2>
              <p className="text-sm text-muted-foreground mt-1">Abre la caja para iniciar el día de facturación.</p>
            </div>
            <button
              onClick={async () => {
                setIsOpeningCash(true);
                const r = await openCashSessionAction();
                if (r.success) { setCashSession(r.data); }
                else { alert(r.message); }
                setIsOpeningCash(false);
              }}
              disabled={isOpeningCash}
              className="w-full py-4 bg-primary hover:bg-primary/80 rounded-2xl font-black text-white transition disabled:opacity-50"
            >
              {isOpeningCash ? "Abriendo..." : "🟢 Abrir Caja"}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card glass-panel w-full max-w-sm rounded-3xl p-8 space-y-4 text-center border border-border shadow-2xl">
          <div className="text-5xl">🔒</div>
          <h2 className="text-xl font-black">Caja no disponible</h2>
          <p className="text-sm text-muted-foreground">La caja no ha sido abierta. Contacta al cajero o gerente.</p>
          <button onClick={loadData} className="text-xs text-primary hover:text-primary/80 font-bold">Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-16 lg:pb-0">
      <CashierShiftModal
        forceOpen={showChangeCashierModal}
        onShiftOpen={(name) => {
          setCashierName(name);
          setShowChangeCashierModal(false);
        }}
      />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="glass-panel px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0 shadow-lg border-b-primary/10">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner">🍸</div>
          <div>
            <h1 className="text-lg md:text-2xl font-black tracking-tight text-foreground">POS <span className="text-primary italic">RESTAURANTE</span></h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              Gestión Táctil CAPSULA · Operaciones en Vivo
              {cashierName ? (
                <span className="flex items-center gap-2 bg-secondary/50 px-2 py-0.5 rounded-full border border-border">
                  👤 {cashierName}
                  <button
                    onClick={() => setShowChangeCashierModal(true)}
                    className="text-primary hover:text-accent font-black underline"
                  >
                    Cambiar
                  </button>
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {activeTab && (
            <div className="hidden md:block">
               <CurrencyCalculator totalUsd={Number(activeTab.balanceDue.toFixed(2))} onRateUpdated={setExchangeRate} />
            </div>
          )}
          <div className="px-4 py-2 bg-secondary/30 rounded-xl border border-border font-black text-sm tabular-nums text-foreground/70">
            {new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ══ LEFT: TABLE GRID ═══════════════════════════════════════════ */}
        <aside className={`w-full lg:w-72 xl:w-80 shrink-0 border-r border-border bg-card/30 flex flex-col overflow-hidden ${mobileTab === "tables" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>
          {/* Zone selector */}
          <div className="p-4 border-b border-border space-y-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Secciones</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setIsPickupMode(true);
                  setSelectedTableId("");
                  setSelectedZoneId("");
                  setUseMultiPayment(false);
                  setPaymentLines([]);
                }}
                className={`capsula-btn min-h-0 py-3 text-sm ${isPickupMode ? "capsula-btn-primary" : "capsula-btn-secondary"}`}
              >
                🛍️ Venta Directa / Pickup
              </button>
              <div className="flex gap-2">
                {layout?.serviceZones.map((z) => (
                  <button
                    key={z.id}
                    onClick={() => {
                      setIsPickupMode(false);
                      setSelectedZoneId(z.id);
                      setSelectedTableId("");
                      setUseMultiPayment(false);
                      setPaymentLines([]);
                    }}
                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all active:scale-95 ${selectedZoneId === z.id && !isPickupMode ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-card border border-border text-foreground/60 hover:border-primary/50"}`}
                  >
                    {z.zoneType === "BAR" ? "🍺" : "🌿"} {z.name}
                  </button>
                ))}
              </div>
            </div>
            {!layout && !layoutError && (
              <div className="flex-1 text-center text-xs text-muted-foreground py-2">Cargando...</div>
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
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-3 gap-3">
              {selectedZone?.tablesOrStations.map((table) => {
                const tab = table.openTabs[0];
                const isSelected = table.id === selectedTableId;
                return (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTableId(table.id)}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 active:scale-90 border-2 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 z-10"
                        : tab
                          ? "border-emerald-500/50 bg-emerald-500/5"
                          : "border-border bg-card/50 hover:border-primary/30"
                    }`}
                  >
                    <div className={`text-sm md:text-base font-black ${isSelected ? 'text-primary' : tab ? 'text-emerald-500' : 'text-foreground/40'}`}>{table.code}</div>
                    {tab ? (
                      <div className="absolute top-1 right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse"></div>
                    ) : null}
                    {tab && (
                      <div className="mt-1 text-[9px] font-black text-foreground/70 truncate w-full px-1 text-center">
                         ${tab.balanceDue.toFixed(0)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected table info & open tab CTA */}
          {selectedTable && (
            <div className="border-t border-border p-3 bg-card">
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
                  {activeTab.customerPhone && <div className="text-muted-foreground">📞 {activeTab.customerPhone}</div>}
                  <div className="text-muted-foreground">
                    Abrió:{" "}
                    <span className="text-white">
                      {activeTab.openedBy.firstName} {activeTab.openedBy.lastName}
                    </span>
                    <span className="text-muted-foreground"> · {formatTime(activeTab.openedAt)}</span>
                  </div>
                  {activeTab.assignedWaiter && (
                    <div className="text-muted-foreground">
                      Mesonero: <span className="text-white">{(activeTab as any).waiterLabel || "—"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ══ CENTER: MENU ════════════════════════════════════════════════ */}
        <main className={`flex-1 flex flex-col border-r border-border bg-background overflow-hidden ${mobileTab === "menu" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>
          {/* Search + Categories */}
          <div className="p-3 border-b border-border space-y-2 shrink-0">
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
              <div className="bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground">
                {selectedTable.name} · Sin cuenta abierta — presiona &quot;Abrir cuenta&quot; para empezar
              </div>
            ) : (
              <div className="bg-secondary border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground">
                Selecciona una mesa para empezar
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={`Buscar producto... ${isPickupMode ? "(Modo Pickup)" : ""}`}
                className={`w-full bg-secondary border ${isPickupMode ? "border-indigo-600/50" : "border-border"} rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-amber-500`}
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setProductSearch("");
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedCategory === cat.id ? "bg-amber-500 text-black" : "bg-secondary text-foreground/70 hover:bg-muted"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu items */}
          <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    disabled={!activeTab && !isPickupMode}
                    className="capsula-card group flex flex-col justify-between p-3 md:p-4 text-left disabled:opacity-30 disabled:grayscale h-28 md:h-32 border-primary/5 hover:border-primary/40 active:scale-95 transition-transform"
                  >
                    <div className="text-sm font-black text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2 uppercase tracking-tight">{item.name}</div>
                    <div className="flex items-end justify-between mt-2">
                      <div className="text-xl font-black text-primary">
                        <PriceDisplay usd={item.price} rate={exchangeRate} size="sm" showBs={false} />
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:group-hover:translate-y-[-4px]">
                        ➕
                      </div>
                    </div>
                  </button>
              ))}
              {filteredMenuItems.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-12 text-sm">
                  {productSearch ? `Sin resultados para "${productSearch}"` : "Sin productos en esta categoría"}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ══ RIGHT: ACCOUNT PANEL ════════════════════════════════════════ */}
        <aside className={`w-full lg:w-80 xl:w-96 shrink-0 bg-card/80 flex flex-col overflow-hidden ${mobileTab === "account" ? "flex" : "hidden"} lg:flex absolute lg:relative inset-0 z-10 lg:z-auto`}>
          {isPickupMode ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-secondary/80">
              <div className="p-4 border-b border-indigo-900/50 bg-indigo-900/20 space-y-2 shrink-0">
                <h2 className="font-black text-lg text-indigo-300 flex items-center gap-2">
                  🛍️ Pickup - Venta Directa
                </h2>
                <input
                  type="text"
                  value={pickupCustomerName}
                  onChange={(e) => setPickupCustomerName(e.target.value)}
                  placeholder="Nombre del Cliente..."
                  className="w-full bg-background/50 border border-indigo-500/30 rounded py-2 px-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                {cart.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Carrito vacío
                  </div>
                )}
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-card p-3 rounded-xl border border-border flex justify-between shadow-sm"
                  >
                    <div>
                      <div className="font-bold text-sm">
                        <span className="text-indigo-400">x{item.quantity}</span> {item.name}
                      </div>
                      {item.modifiers.length > 0 && (
                        <div className="text-xs text-muted-foreground pl-4">
                          {item.modifiers.map((m) => m.name).join(", ")}
                        </div>
                      )}
                      {item.notes && <div className="text-xs text-amber-300 pl-4 italic">&quot;{item.notes}&quot;</div>}
                    </div>
                    <div className="text-right flex flex-col justify-between items-end">
                      <div className="font-bold text-sm leading-none">${item.lineTotal.toFixed(2)}</div>
                      <button
                        onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}
                        className="text-red-400/80 text-xs hover:text-red-300 leading-none"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-card border-t border-border space-y-3 shrink-0">
                {/* Descuento */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={clearDiscount}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${discountType === "NONE" ? "bg-muted-foreground/60 text-white ring-1 ring-white" : "bg-secondary hover:bg-muted"}`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => isPagoDivisas ? setDiscountType("DIVISAS_33") : undefined}
                    disabled={!isPagoDivisas}
                    title={!isPagoDivisas ? "Solo con Efectivo o Zelle" : ""}
                    className={`py-1.5 text-xs font-bold rounded-lg transition ${discountType === "DIVISAS_33" ? "bg-indigo-600 text-white" : isPagoDivisas ? "bg-secondary text-foreground/70 hover:bg-muted" : "bg-secondary text-foreground/50 cursor-not-allowed opacity-50"}`}
                  >
                    Divisas -33%
                  </button>
                  <button
                    onClick={openCortesiaModal}
                    className={`col-span-2 py-1.5 text-xs font-bold rounded-lg transition ${(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") ? "bg-purple-600 text-white" : "bg-secondary text-foreground/70 hover:bg-muted"}`}
                  >
                    {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT")
                      ? `🎁 Cortesía ${discountType === "CORTESIA_PERCENT" ? cortesiaPercentNum + "%" : "100%"}`
                      : "🎁 Cortesía (PIN)"}
                  </button>
                </div>
                {/* Métodos de pago */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Forma de pago</span>
                    <button
                      onClick={() => { setUseMultiPayment(p => !p); setPaymentLines([]); }}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${useMultiPayment ? "bg-blue-600 text-white" : "bg-card border border-border text-foreground/50 hover:bg-muted"}`}
                    >
                      {useMultiPayment ? "✓ Pago Mixto" : "+ Pago Mixto"}
                    </button>
                  </div>
                  {!useMultiPayment ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(["CASH", "CASH_BS", "ZELLE", "CARD", "MOBILE_PAY", "TRANSFER"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPaymentMethod(m)}
                          className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all active:scale-95 ${paymentMethod === m ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-card border border-border text-foreground/50"}`}
                        >
                          {PAYMENT_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {paymentLines.map((line, idx) => {
                        const isDivisas = DIVISAS_METHODS_SET.has(line.method);
                        const amt = parseFloat(line.amount) || 0;
                        const covers = isDivisas ? amt * 1.5 : amt;
                        return (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex gap-1.5 items-center">
                              <select
                                value={line.method}
                                onChange={e => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, method: e.target.value as any } : l))}
                                className={`flex-1 bg-background/50 border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none ${isDivisas ? "border-blue-500/60 focus:border-blue-400" : "border-indigo-500/30 focus:border-indigo-400"}`}
                              >
                                <option value="CASH">💵 Efectivo $</option>
                                <option value="CASH_BS">🇻🇪 Efectivo Bs</option>
                                <option value="ZELLE">⚡ Zelle</option>
                                <option value="CARD">💳 Tarjeta</option>
                                <option value="MOBILE_PAY">📱 Pago Móvil</option>
                                <option value="TRANSFER">🏦 Transferencia</option>
                              </select>
                              <input
                                type="number"
                                value={line.amount}
                                onChange={e => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                                placeholder="$0.00"
                                className={`w-20 bg-background/50 border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none ${isDivisas ? "border-blue-500/60 focus:border-blue-400" : "border-indigo-500/30 focus:border-indigo-400"}`}
                              />
                              <button
                                onClick={() => setPaymentLines(prev => prev.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-300 text-base leading-none px-1"
                              >×</button>
                            </div>
                            {isDivisas && amt > 0 && (
                              <div className="text-[10px] text-blue-400 pl-1">
                                💱 Cubre ${covers.toFixed(2)} del total (descuento -${(amt * 0.5).toFixed(2)})
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setPaymentLines(prev => [...prev, { method: "CASH", amount: "" }])}
                        className="w-full py-1 bg-background/30 border border-dashed border-indigo-500/30 rounded text-xs text-muted-foreground hover:text-foreground hover:border-indigo-400 transition"
                      >+ Agregar método</button>
                      {mixedDivisasDiscount > 0 && (
                        <div className="text-[10px] text-blue-400 bg-blue-950/30 rounded px-2 py-1">
                          Descuento divisas parcial: <span className="font-bold">-${mixedDivisasDiscount.toFixed(2)}</span> · A cobrar: <span className="font-bold">${mixedPickupBase.toFixed(2)}</span>
                        </div>
                      )}
                      <div className={`text-xs text-right font-bold ${multiPickupRemaining > 0.005 ? "text-amber-400" : "text-emerald-400"}`}>
                        {multiPickupRemaining > 0.005 ? `Falta: $${multiPickupRemaining.toFixed(2)}` : `✓ Cubierto $${multiTotal.toFixed(2)}`}
                      </div>
                    </div>
                  )}
                </div>

                {/* Total calculado pickup */}
                <div className="space-y-4 pt-2">
                  {!useMultiPayment && (
                    <div className="flex items-center gap-2 bg-background border border-border p-1 rounded-2xl">
                      <input
                        type="number"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="Recibido..."
                        className="flex-1 bg-transparent border-none rounded-xl px-4 py-3 text-lg font-black focus:ring-0 placeholder:text-muted-foreground/30"
                      />
                      <div className="pr-4 text-xs font-black text-muted-foreground uppercase">USD</div>
                    </div>
                  )}
                  <div className="glass-panel p-4 rounded-2xl border-primary/5">
                    <CurrencyCalculator
                      totalUsd={pickupTotal}
                      hasServiceFee={false}
                      onRateUpdated={setExchangeRate}
                      className="w-full justify-center"
                    />
                  </div>
                  <button
                    onClick={handleCheckoutPickup}
                    disabled={cart.length === 0 || isProcessing || (useMultiPayment && !multiPickupValid)}
                    className="capsula-btn capsula-btn-primary w-full py-6 text-xl shadow-xl shadow-primary/20"
                  >
                    {isProcessing ? "PROCESANDO..." : useMultiPayment ? `COBRAR MIXTO $${pickupTotal.toFixed(2)}` : `COBRAR $${pickupTotal.toFixed(2)}`}
                  </button>
                </div>
                {lastPickupOrder && (
                  <button
                    onClick={() => {
                      printReceipt({
                        orderNumber: lastPickupOrder.orderNumber,
                        orderType: "RESTAURANT",
                        date: new Date(),
                        cashierName: cashierName || "Cajera",
                        customerName: lastPickupOrder.customerName,
                        items: lastPickupOrder.items,
                        subtotal: lastPickupOrder.subtotal,
                        discount: lastPickupOrder.discount,
                        discountReason: lastPickupOrder.discount > 0 ? "Descuento aplicado" : undefined,
                        total: lastPickupOrder.total,
                        serviceFee: 0,
                      });
                    }}
                    className="w-full py-3 bg-muted hover:bg-secondary/80 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-border text-sm"
                  >
                    🖨️ Imprimir factura {lastPickupOrder.orderNumber}
                  </button>
                )}
              </div>
            </div>
          ) : !activeTab ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground text-sm">
              {selectedTable
                ? "Abre una cuenta para gestionar consumos"
                : "Selecciona una mesa o usa Venta Directa (Pickup)"}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab header */}
              <div className="p-3 border-b border-border bg-card space-y-1.5 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-base">{activeTab.customerLabel}</div>
                    {activeTab.customerPhone && (
                      <div className="text-xs text-muted-foreground">📞 {activeTab.customerPhone}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase">Saldo</div>
                    <div className="text-xl font-black text-amber-400">
                      <PriceDisplay usd={activeTab.balanceDue} rate={exchangeRate} size="md" showBs={false} />
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>
                    🔓 Abrió:{" "}
                    <span className="text-foreground/70">
                      {activeTab.openedBy.firstName} {activeTab.openedBy.lastName}
                    </span>{" "}
                    · {formatDateTime(activeTab.openedAt)}
                  </div>
                  {(activeTab as any).waiterLabel && (
                    <div>
                      👤 Mesonero: <span className="text-foreground/70">{(activeTab as any).waiterLabel}</span>
                    </div>
                  )}
                  <div>
                    🏷️ {activeTab.tabCode} · {activeTab.guestCount} pax ·{" "}
                    <span className={activeTab.status === "OPEN" ? "text-emerald-400" : "text-amber-400"}>
                      {activeTab.status}
                    </span>
                  </div>
                </div>

                {/* ── Subcuentas: pills de selección + botón dividir ── */}
                {(tabSubTabs.length > 0 || parentTab) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {/* Pill cuenta principal */}
                    <button
                      onClick={() => setSelectedSubTabId(null)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${
                        selectedSubTabId === null
                          ? "bg-amber-500 text-black border-amber-500"
                          : "bg-card text-foreground/60 border-border hover:border-amber-500/50"
                      }`}
                    >
                      Principal ${(parentTab?.balanceDue ?? 0).toFixed(2)}
                    </button>

                    {/* Pills por subcuenta */}
                    {tabSubTabs.map(st => (
                      <button
                        key={st.id}
                        onClick={() => setSelectedSubTabId(st.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition border ${
                          selectedSubTabId === st.id
                            ? "bg-amber-500 text-black border-amber-500"
                            : st.status === "CLOSED"
                            ? "bg-green-900/30 text-green-400 border-green-800/50"
                            : "bg-card text-foreground/60 border-border hover:border-amber-500/50"
                        }`}
                      >
                        {st.customerLabel || `Sub ${st.splitIndex}`} ${st.balanceDue.toFixed(2)}
                        {st.status === "CLOSED" && " ✓"}
                      </button>
                    ))}

                    {/* Botón dividir — solo visible desde la cuenta padre */}
                    {!activeTab.parentTabId && activeTab.orders.some(o => o.items.length > 0) && (
                      <button
                        onClick={() => setShowSplitModal(true)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition"
                      >
                        ＋ Dividir
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Temporary cart */}
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Carrito (nueva tanda)</span>
                    <span className="text-xs font-bold text-amber-400">
                      <PriceDisplay usd={cartTotal} rate={exchangeRate} size="sm" showBs={false} />
                    </span>
                  </div>
                  {cart.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-2">Agrega items del menú</div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {cart.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-card rounded-lg px-2 py-1.5"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {item.quantity}× {item.name}
                            </div>
                            {item.modifiers.length > 0 && (
                              <div className="text-muted-foreground truncate">
                                {item.modifiers.map((m) => m.name).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <span className="text-amber-400 font-bold">${item.lineTotal.toFixed(2)}</span>
                            <button
                              onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-300 text-base leading-none"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleSendToTab}
                    disabled={cart.length === 0 || isProcessing}
                    className="mt-2 w-full py-2 bg-muted hover:bg-secondary/80 rounded-lg text-xs font-black transition disabled:opacity-40"
                  >
                    Agregar consumo a la cuenta →
                  </button>
                </div>

                {/* Consumed orders */}
                {activeTab.orders.length > 0 && (
                  <div className="rounded-xl border border-border bg-secondary p-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Consumos cargados</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeTab.orders.map((order) => (
                        <div key={order.id} className="bg-card rounded-lg p-2">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>{order.orderNumber}</span>
                            <span className="flex items-center gap-1">
                              {order.createdBy && <span>{order.createdBy.firstName}</span>}·{" "}
                              {formatTime(order.createdAt)}
                            </span>
                          </div>
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-foreground/70 flex-1 truncate">
                                {item.quantity}× {item.itemName}
                              </span>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                <span className="text-muted-foreground">${item.lineTotal.toFixed(2)}</span>
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
                          <div className="text-right text-[10px] text-amber-400 font-bold mt-1">
                            ${order.total.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cerrar cuenta padre con $0 saldo (todos los ítems divididos) */}
                {!activeTab.parentTabId && activeTab.balanceDue <= 0.01 && tabSubTabs.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm("¿Cerrar la cuenta principal? (saldo $0, todo dividido en subcuentas)")) return;
                      setIsProcessing(true);
                      const res = await closeZeroBalanceTabAction(activeTab.id);
                      setIsProcessing(false);
                      if (res.success) {
                        setSelectedSubTabId(null);
                        await loadData();
                      } else {
                        alert(res.message || "Error cerrando cuenta");
                      }
                    }}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl border border-green-700/60 bg-green-900/20 text-green-400 text-xs font-bold hover:bg-green-900/40 transition disabled:opacity-40"
                  >
                    ✅ Cerrar cuenta principal ($0 — todo dividido)
                  </button>
                )}

                {/* Estado de Cuenta (pre-bill) */}
                <button
                  onClick={handlePrintEstadoDeCuenta}
                  className="w-full mb-2 py-2 rounded-lg border border-blue-400/40 bg-blue-900/20 text-blue-300 text-xs font-bold hover:bg-blue-900/40 transition flex items-center justify-center gap-1.5"
                  title="Imprime totales con y sin descuento divisas. Registrado en auditoría."
                >
                  🧾 Estado de Cuenta
                  {localPreBillCount > 0 && (
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${localPreBillCount > 2 ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                      {localPreBillCount}×
                    </span>
                  )}
                </button>

                {/* Payment section */}
                <div className="rounded-xl border border-border bg-secondary p-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Cobrar cuenta</div>

                  {/* 1. Descuento */}
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">1. Descuento</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={clearDiscount}
                        className={`py-1.5 text-xs font-bold rounded-lg transition ${discountType === "NONE" ? "bg-muted-foreground/60 text-white ring-1 ring-white" : "bg-card text-foreground/70 hover:bg-muted"}`}
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => {
                          if (isPagoDivisas && !useMultiPayment) {
                            setDiscountType("DIVISAS_33");
                            setIsDivisasLocked(true); // 🔒 Bloquear cambio de método
                          }
                        }}
                        disabled={!isPagoDivisas || useMultiPayment}
                        title={useMultiPayment ? "No disponible en Pago Mixto" : !isPagoDivisas ? "Solo con Efectivo o Zelle" : "Descuento por pago en divisas"}
                        className={`py-1.5 text-xs font-bold rounded-lg transition ${discountType === "DIVISAS_33" ? "bg-blue-600 text-white ring-1 ring-white" : (isPagoDivisas && !useMultiPayment) ? "bg-card text-foreground/70 hover:bg-muted" : "bg-card text-foreground/50 cursor-not-allowed opacity-50"}`}
                      >
                        {discountType === "DIVISAS_33" && isDivisasLocked ? "🔒 Divisas -33%" : "Divisas -33%"}
                      </button>
                      <button
                        onClick={openCortesiaModal}
                        className={`col-span-2 py-1.5 text-xs font-bold rounded-lg transition ${(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") ? "bg-purple-600 text-white ring-1 ring-purple-400" : "bg-card text-foreground/70 hover:bg-muted"}`}
                      >
                        {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT")
                          ? `🎁 Cortesía ${discountType === "CORTESIA_PERCENT" ? cortesiaPercentNum + "%" : "100%"} — ${authorizedManager?.name || ""}`
                          : "🎁 Cortesía (PIN)"}
                      </button>
                    </div>
                    {discountType === "DIVISAS_33" && (
                      <p className="text-[10px] text-blue-400 mt-1">
                        Descuento: -${(activeTab.balanceDue / 3).toFixed(2)} → Total: $
                        {((activeTab.balanceDue * 2) / 3).toFixed(2)}
                      </p>
                    )}
                    {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") && (
                      <p className="text-[10px] text-purple-400 mt-1">
                        Descuento: -${(activeTab.balanceDue * (cortesiaPercentNum / 100)).toFixed(2)} → Total: ${(activeTab.balanceDue * (1 - cortesiaPercentNum / 100)).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* 2. Método de pago */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">2. Forma de pago</p>
                      <button
                        onClick={() => { setUseMultiPayment(p => !p); setPaymentLines([]); }}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${useMultiPayment ? "bg-blue-600 text-white" : "bg-card border border-border text-foreground/50 hover:bg-muted"}`}
                      >
                        {useMultiPayment ? "✓ Pago Mixto" : "+ Pago Mixto"}
                      </button>
                    </div>
                    {!useMultiPayment ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["CASH", "CASH_BS", "ZELLE", "CARD", "MOBILE_PAY", "TRANSFER"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => handleChangePaymentMethod(m)}
                            className={`py-2 rounded-lg text-xs font-bold transition ${paymentMethod === m ? "bg-amber-500 text-black" : "bg-card text-foreground/70 hover:bg-muted"}`}
                          >
                            {PAYMENT_LABELS[m]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {paymentLines.map((line, idx) => {
                          const isDivisas = DIVISAS_METHODS_SET.has(line.method);
                          const amt = parseFloat(line.amount) || 0;
                          const covers = isDivisas ? amt * 1.5 : amt;
                          return (
                            <div key={idx} className="space-y-0.5">
                              <div className="flex gap-1.5 items-center">
                                <select
                                  value={line.method}
                                  onChange={e => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, method: e.target.value as any } : l))}
                                  className={`flex-1 bg-card border rounded px-2 py-1.5 text-xs text-foreground ${isDivisas ? "border-blue-500/60" : "border-border"}`}
                                >
                                  <option value="CASH">💵 Efectivo</option>
                                  <option value="ZELLE">⚡ Zelle</option>
                                  <option value="CARD">💳 Tarjeta</option>
                                  <option value="MOBILE_PAY">📱 Pago Móvil</option>
                                  <option value="TRANSFER">🏦 Transferencia</option>
                                </select>
                                <input
                                  type="number"
                                  value={line.amount}
                                  onChange={e => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                                  placeholder="$0.00"
                                  className={`w-20 bg-card border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none ${isDivisas ? "border-blue-500/60 focus:border-blue-400" : "border-border focus:border-amber-500"}`}
                                />
                                <button
                                  onClick={() => setPaymentLines(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-400 hover:text-red-300 text-base leading-none px-1"
                                >×</button>
                              </div>
                              {isDivisas && amt > 0 && (
                                <div className="text-[10px] text-blue-400 pl-1">
                                  💱 Cubre ${covers.toFixed(2)} del saldo (descuento -${(amt * 0.5).toFixed(2)})
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => setPaymentLines(prev => [...prev, { method: "CASH", amount: "" }])}
                          className="w-full py-1 bg-card border border-dashed border-border rounded text-xs text-muted-foreground hover:text-foreground hover:border-amber-500 transition"
                        >+ Agregar método</button>
                        {mixedDivisasDiscount > 0 && (
                          <div className="text-[10px] text-blue-400 bg-blue-950/30 rounded px-2 py-1">
                            Descuento divisas parcial: <span className="font-bold">-${mixedDivisasDiscount.toFixed(2)}</span> · A cobrar total: <span className="font-bold">${mixedTabTotal.toFixed(2)}</span>
                          </div>
                        )}
                        <div className={`text-xs text-right font-bold ${multiTabRemaining > 0.005 ? "text-amber-400" : "text-emerald-400"}`}>
                          {multiTabRemaining > 0.005 ? `Falta: $${multiTabRemaining.toFixed(2)}` : `✓ Cubierto $${multiTotal.toFixed(2)}`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumen */}
                  <div className="bg-card rounded-lg px-3 py-2 mb-2 text-xs space-y-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Saldo</span>
                      <span>${activeTab.balanceDue.toFixed(2)}</span>
                    </div>
                    {discountType === "DIVISAS_33" && !useMultiPayment && (
                      <div className="flex justify-between text-blue-400">
                        <span>Descuento divisas</span>
                        <span>-${(activeTab.balanceDue / 3).toFixed(2)}</span>
                      </div>
                    )}
                    {(discountType === "CORTESIA_100" || discountType === "CORTESIA_PERCENT") && (
                      <div className="flex justify-between text-purple-400">
                        <span>Cortesía {discountType === "CORTESIA_PERCENT" ? cortesiaPercentNum + "%" : "100%"}</span>
                        <span>-${(activeTab.balanceDue * (cortesiaPercentNum / 100)).toFixed(2)}</span>
                      </div>
                    )}
                    {useMultiPayment && mixedDivisasDiscount > 0 && (
                      <div className="flex justify-between text-blue-400">
                        <span>💱 Divisas parcial</span>
                        <span>-${mixedDivisasDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={serviceFeeIncluded}
                        onChange={(e) => setServiceFeeIncluded(e.target.checked)}
                        className="rounded border-border bg-secondary text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-foreground/70">Incluir 10% servicio</span>
                    </label>
                    <div className="flex justify-between font-bold text-white border-t border-border pt-1">
                      <span>A cobrar</span>
                      <span>${useMultiPayment ? mixedTabTotal.toFixed(2) : paymentAmountToCharge.toFixed(2)}</span>
                    </div>
                    {!serviceFeeIncluded && (
                      <div className="flex justify-between text-amber-500/80 text-[10px]">
                        <span>Sin 10% servicio</span>
                      </div>
                    )}
                  </div>

                  {!useMultiPayment && (
                    <>
                      <input
                        type="number"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder={`Monto a recibir ($${paymentAmountToCharge.toFixed(2)})`}
                        className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none mb-2"
                      />
                      <CurrencyCalculator
                        totalUsd={paidAmount > 0 ? paidAmount : paymentAmountToCharge}
                        hasServiceFee={false}
                        onRateUpdated={setExchangeRate}
                        className="w-full justify-center mb-2"
                      />
                    </>
                  )}

                  {/* Register payment (requiere PIN) */}
                  <button
                    onClick={() => {
                      setPaymentPin("");
                      setPaymentPinError("");
                      setShowPaymentPinModal(true);
                    }}
                    disabled={(useMultiPayment ? !multiTabValid : (
                      // Cortesía 100%: no requiere monto (se cierra sin cobro)
                      (discountType === "CORTESIA_100" || (discountType === "CORTESIA_PERCENT" && cortesiaPercentNum >= 100))
                        ? false
                        : paidAmount <= 0
                    )) || isProcessing}
                    className="capsula-btn capsula-btn-primary w-full py-5 text-sm shadow-xl shadow-primary/10"
                  >
                    🔐 {(discountType === "CORTESIA_100" || (discountType === "CORTESIA_PERCENT" && cortesiaPercentNum >= 100))
                      ? "REGISTRAR CORTESÍA 100% (CERRAR)"
                      : useMultiPayment
                        ? `PAGO MIXTO $${multiTotal.toFixed(2)}`
                        : `REGISTRAR PAGO $${paidAmount > 0 ? paidAmount.toFixed(2) : "0.00"}`}
                  </button>

                  {/* Paid splits */}
                  {activeTab.paymentSplits.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {activeTab.paymentSplits.map((p) => {
                        const hasService = (p.splitLabel || "").includes("| +10% serv");
                        const label = (p.splitLabel || "").replace(" | +10% serv", "");
                        return (
                          <div
                            key={p.id}
                            className="flex justify-between items-center text-[10px] text-muted-foreground bg-card rounded px-2 py-1"
                          >
                            <span>
                              {label}
                              {hasService && (
                                <span className="ml-1 text-emerald-400 font-bold">+10%</span>
                              )}
                            </span>
                            <span className="text-emerald-400 font-bold">${p.paidAmount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="mt-2 text-[10px] text-muted-foreground text-center">La factura se imprime al registrar el pago. Reimprimir desde Historial de Ventas.</p>
                  {/* Close tab - permitir cerrar cuando no hay consumo (saldo 0) o ya se cobró */}
                  <button
                    onClick={handleCloseTab}
                    disabled={(Number(activeTab.balanceDue ?? 0) > 0.01) || isProcessing}
                    className="mt-2 w-full py-2 border border-border rounded-lg text-xs font-bold text-foreground/70 hover:bg-muted transition disabled:opacity-30"
                  >
                    Cerrar cuenta (saldo ${(Number(activeTab.balanceDue ?? 0)).toFixed(2)})
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
        <div className="fixed inset-0 z-50 bg-background/90 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h3 className="text-lg font-black">Abrir cuenta — {selectedTable.name}</h3>
              <button
                onClick={() => setShowOpenTabModal(false)}
                className="text-muted-foreground hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Nombre del cliente <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={openTabName}
                  onChange={(e) => setOpenTabName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Teléfono del cliente <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={openTabPhone}
                  onChange={(e) => setOpenTabPhone(e.target.value)}
                  placeholder="Ej: 0414-1234567"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Número de personas</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOpenTabGuests(Math.max(1, openTabGuests - 1))}
                      className="w-9 h-9 bg-secondary rounded-lg font-bold text-lg"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center font-black text-lg">{openTabGuests}</span>
                    <button
                      onClick={() => setOpenTabGuests(openTabGuests + 1)}
                      className="w-9 h-9 bg-amber-600 rounded-lg font-bold text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Mesonero asignado</label>
                  <select
                    value={openTabWaiter}
                    onChange={(e) => setOpenTabWaiter(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">— Ninguno —</option>
                    <option value="1">Mesonero 1</option>
                    <option value="2">Mesonero 2</option>
                    <option value="3">Mesonero 3</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <button
                onClick={() => setShowOpenTabModal(false)}
                className="flex-1 py-3 bg-secondary hover:bg-muted rounded-xl font-bold text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenTab}
                disabled={isProcessing || !openTabName.trim() || !openTabPhone.trim()}
                className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm transition disabled:opacity-50"
              >
                {isProcessing ? "Abriendo..." : "✓ Abrir cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PIN CAJERA — REGISTRAR PAGO                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showPaymentPinModal && activeTab && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h3 className="text-lg font-black">🔐 Autorizar cobro</h3>
              <button
                onClick={() => setShowPaymentPinModal(false)}
                className="text-muted-foreground hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-secondary rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método:</span>
                  <span className="font-bold">{PAYMENT_LABELS[paymentMethod]}</span>
                </div>
                {discountType === "DIVISAS_33" && activeTab && (
                  <div className="flex justify-between text-blue-400 text-xs">
                    <span>Descuento -33.33%:</span>
                    <span>-${(activeTab.balanceDue / 3).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monto:</span>
                  <span className="font-black text-emerald-400 text-base">${paidAmount.toFixed(2)}</span>
                </div>
                {exchangeRate && (
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>Equivalente Bs:</span>
                    <span>Bs. {(paidAmount * exchangeRate).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">PIN de cajera / gerente</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={paymentPin}
                  onChange={(e) => {
                    setPaymentPin(e.target.value);
                    setPaymentPinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePaymentPinConfirm()}
                  placeholder="••••••"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-white text-center text-xl tracking-widest focus:border-amber-500 focus:outline-none"
                />
                {paymentPinError && <p className="text-red-400 text-xs mt-1">{paymentPinError}</p>}
              </div>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <button
                onClick={() => setShowPaymentPinModal(false)}
                className="flex-1 py-3 bg-secondary rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handlePaymentPinConfirm}
                disabled={!paymentPin || isProcessing}
                className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-sm transition disabled:opacity-50"
              >
                {isProcessing ? "Procesando..." : "✓ Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CORTESÍA (PIN + PORCENTAJE)                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showCortesiaModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-purple-800/60 w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-purple-300">🎁 Cortesía</h3>
              <button onClick={() => setShowCortesiaModal(false)} className="text-muted-foreground hover:text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">% de Cortesía</label>
                <div className="flex gap-2 mb-2">
                  {["25", "50", "75", "100"].map(v => (
                    <button key={v} onClick={() => setCortesiaPercent(v)}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${cortesiaPercent === v ? "bg-purple-600 text-white" : "bg-secondary text-foreground/70 hover:bg-muted"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
                <input
                  type="number" min="1" max="100"
                  value={cortesiaPercent}
                  onChange={e => setCortesiaPercent(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-white text-center text-lg font-bold focus:border-purple-500 focus:outline-none"
                  placeholder="% personalizado"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Razón / Justificación <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={cortesiaReason}
                  onChange={e => { setCortesiaReason(e.target.value); setCortesiaPinError(""); }}
                  placeholder="Ej: Mesa VIP, cliente frecuente, error de cocina..."
                  rows={2}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">PIN de Gerente / Dueño</label>
                <div className="bg-secondary p-3 rounded-xl text-2xl tracking-widest text-center font-mono mb-3 min-h-[3rem]">
                  {cortesiaPin.replace(/./g, "•")}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9,0].map(n => (
                    <button key={n} onClick={() => handleCortesiaPinKey(n.toString())}
                      className="bg-muted hover:bg-secondary/80 rounded-lg py-3 font-bold text-xl">{n}</button>
                  ))}
                  <button onClick={() => handleCortesiaPinKey("clear")} className="bg-red-900 hover:bg-red-800 rounded-lg py-3 font-bold text-red-200 text-sm">C</button>
                  <button onClick={() => handleCortesiaPinKey("back")} className="bg-secondary hover:bg-muted-foreground/60 rounded-lg py-3 font-bold">⌫</button>
                </div>
                {cortesiaPinError && <p className="text-red-400 text-xs mt-2 text-center">{cortesiaPinError}</p>}
              </div>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <button onClick={() => setShowCortesiaModal(false)} className="flex-1 py-3 bg-secondary rounded-xl font-bold text-sm">Cancelar</button>
              <button onClick={handleCortesiaPinConfirm} disabled={!cortesiaPin || !cortesiaReason.trim()} className="flex-[2] py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-black text-sm transition">
                Aplicar Cortesía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BANNER: REPORTE CORTESÍA → WHATSAPP                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {cortesiaReportData && (
        <div className="fixed bottom-4 left-1/2 z-[70] w-full max-w-sm -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-purple-700/60 bg-purple-950 p-4 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-3">
              <p className="font-black text-purple-300 text-sm">🎁 Cortesía registrada</p>
              <button onClick={() => setCortesiaReportData(null)} className="text-purple-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="text-xs text-purple-200 mb-1">
              <span className="font-bold">{cortesiaReportData.tabCode}</span>
              {cortesiaReportData.customerLabel && <span> · {cortesiaReportData.customerLabel}</span>}
            </div>
            <div className="text-xs text-purple-300 mb-3">
              Total: <span className="line-through">${cortesiaReportData.totalOriginal.toFixed(2)}</span>{" "}
              → Descuento {cortesiaReportData.discountPercent}%{" "}
              → Cobrado: <span className="font-bold">${cortesiaReportData.totalCharged.toFixed(2)}</span>
            </div>
            <button
              onClick={() => {
                const d = cortesiaReportData;
                const fecha = new Date(d.date).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
                const items = d.items.map(i => `• ${i.quantity}× ${i.name} — $${i.total.toFixed(2)}`).join("\n");
                const msg = [
                  `🎁 *CORTESÍA — Table Pong*`,
                  `📅 ${fecha}`,
                  `🪑 Cuenta: ${d.tabCode}${d.customerLabel ? ` · ${d.customerLabel}` : ""}`,
                  ``,
                  `*Consumo:*`,
                  items,
                  ``,
                  `💰 Total original: *$${d.totalOriginal.toFixed(2)}*`,
                  `🎁 Cortesía ${d.discountPercent}%: -$${d.discountAmount.toFixed(2)}`,
                  `✅ Cobrado: *$${d.totalCharged.toFixed(2)}*`,
                  d.authorizedBy ? `👔 Autorizado: *${d.authorizedBy}*` : null,
                  d.reason ? `📝 Razón: ${d.reason}` : null,
                ].filter(Boolean).join("\n");
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
              className="w-full py-2.5 bg-[#25D366] hover:bg-[#22c55e] rounded-xl font-black text-sm text-white flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.842L.057 23.999l6.304-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.81 9.81 0 01-5.001-1.37l-.36-.213-3.722.976.994-3.629-.233-.374A9.795 9.795 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
              Enviar reporte a WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BANNER: ALERTA PRE-BILL > 2 IMPRESIONES → WA ADMIN              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {preBillWAAlert && (
        <div className="fixed bottom-4 left-1/2 z-[70] w-full max-w-sm -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-red-700/60 bg-red-950 p-4 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="font-black text-red-300 text-sm">⚠️ {preBillWAAlert.count} impresiones de Estado de Cuenta</p>
              <button onClick={() => setPreBillWAAlert(null)} className="text-red-400 hover:text-white text-xl">×</button>
            </div>
            <p className="text-xs text-red-200 mb-3">
              Mesa <strong>{preBillWAAlert.tabCode}</strong>{preBillWAAlert.tableName ? ` · ${preBillWAAlert.tableName}` : ''} · ${preBillWAAlert.balance.toFixed(2)}
            </p>
            <button
              onClick={() => {
                const d = preBillWAAlert;
                const msg = [
                  `⚠️ *ALERTA ANTI-FRAUDE — Table Pong POS*`,
                  `📅 ${new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}`,
                  ``,
                  `Se imprimió el *Estado de Cuenta ${d.count} veces* antes de cobrar.`,
                  `🪑 Cuenta: ${d.tabCode}${d.tableName ? ` · ${d.tableName}` : ''}`,
                  `💰 Saldo: $${d.balance.toFixed(2)}`,
                  ``,
                  `_Esto puede indicar un intento de cobrar con divisas y registrar sin descuento._`,
                  `Verificar con cajera y auditar cierre de caja.`,
                ].join('\n');
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full py-2.5 bg-[#25D366] hover:bg-[#22c55e] rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.842L.057 23.999l6.304-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.81 9.81 0 01-5.001-1.37l-.36-.213-3.722.976.994-3.629-.233-.374A9.795 9.795 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
              Alertar al Admin por WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: DESBLOQUEAR CAMBIO DE MÉTODO (DIVISAS LOCK)               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showDivisasUnlockModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-blue-800/60 w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h3 className="text-base font-black text-blue-300">🔒 Cambiar método de pago</h3>
              <button onClick={() => setShowDivisasUnlockModal(false)} className="text-muted-foreground hover:text-white text-2xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                El descuento <strong className="text-blue-400">Divisas -33%</strong> ya fue seleccionado. Cambiar el método de pago cancelará ese descuento y requiere autorización de Gerente.
              </p>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">PIN de Gerente</label>
                <input
                  type="password"
                  value={divisasUnlockPin}
                  onChange={e => { setDivisasUnlockPin(e.target.value); setDivisasUnlockError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleDivisasUnlockConfirm()}
                  placeholder="••••••"
                  autoFocus
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-white text-center text-xl tracking-widest focus:border-blue-500 focus:outline-none"
                />
                {divisasUnlockError && <p className="text-red-400 text-xs mt-1 text-center">{divisasUnlockError}</p>}
              </div>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <button onClick={() => setShowDivisasUnlockModal(false)} className="flex-1 py-3 bg-secondary rounded-xl font-bold text-sm">Cancelar</button>
              <button
                onClick={handleDivisasUnlockConfirm}
                disabled={!divisasUnlockPin}
                className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-black text-sm"
              >
                Autorizar cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ELIMINAR ITEM (PIN + JUSTIFICACIÓN)                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showRemoveModal && removeTarget && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-red-900/50 w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="border-b border-border p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-red-400">🗑️ Eliminar item</h3>
              <button onClick={() => setShowRemoveModal(false)} className="text-muted-foreground hover:text-white text-2xl">
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3 text-sm">
                <div className="font-bold text-white">
                  {removeTarget.qty}× {removeTarget.itemName}
                </div>
                <div className="text-red-400 font-black">−${removeTarget.lineTotal.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Justificación <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={removeJustification}
                  onChange={(e) => {
                    setRemoveJustification(e.target.value);
                    setRemoveError("");
                  }}
                  placeholder="Ej: Error de pedido, cliente cambió de opinión..."
                  rows={2}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  PIN de cajera / gerente <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={removePin}
                  onChange={(e) => {
                    setRemovePin(e.target.value);
                    setRemoveError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleRemoveItem()}
                  placeholder="••••••"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-3 text-white text-center text-xl tracking-widest focus:border-red-500 focus:outline-none"
                />
                {removeError && <p className="text-red-400 text-xs mt-1">{removeError}</p>}
              </div>
            </div>
            <div className="border-t border-border p-4 flex gap-3">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="flex-1 py-3 bg-secondary rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleRemoveItem}
                disabled={!removePin || !removeJustification.trim() || isProcessing}
                className="flex-[2] py-3 bg-red-700 hover:bg-red-600 rounded-xl font-black text-sm transition disabled:opacity-50"
              >
                {isProcessing ? "Eliminando..." : "Eliminar item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: MODIFICADORES                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {showModifierModal && selectedItemForModifier && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 p-4 text-foreground">
          <div className="max-h-[92vh] sm:max-h-[90vh] w-full max-w-lg mx-auto overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border p-5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-white">{selectedItemForModifier.name}</h3>
                <p className="mt-1 text-lg font-bold text-amber-400">${selectedItemForModifier.price.toFixed(2)}</p>
              </div>
              <button onClick={() => setShowModifierModal(false)} className="text-muted-foreground hover:text-white text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-5 p-5">
              {selectedItemForModifier.modifierGroups.map((gr) => {
                const group = gr.modifierGroup;
                const totalSel = currentModifiers
                  .filter((m) => m.groupId === group.id)
                  .reduce((s, m) => s + m.quantity, 0);
                return (
                  <div key={group.id} className="rounded-xl border border-border bg-secondary p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-white">
                        {group.name}
                        {group.isRequired && <span className="text-red-400 ml-1 text-xs">*</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {totalSel}/{group.maxSelections}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.modifiers
                        .filter((m) => m.isAvailable)
                        .map((modifier) => {
                          const sel = currentModifiers.find((m) => m.id === modifier.id && m.groupId === group.id);
                          const qty = sel?.quantity || 0;
                          const isRadio = group.maxSelections === 1;
                          return (
                            <div
                              key={modifier.id}
                              className="flex items-center justify-between rounded-lg bg-card px-3 py-2"
                            >
                              <div>
                                <div className="text-sm font-medium text-foreground">{modifier.name}</div>
                                {modifier.priceAdjustment !== 0 && (
                                  <div className="text-xs text-muted-foreground">+${modifier.priceAdjustment.toFixed(2)}</div>
                                )}
                              </div>
                              {isRadio ? (
                                <button
                                  onClick={() => updateModifierQuantity(group, modifier, 1)}
                                  className={`h-7 w-7 rounded-full border text-sm ${qty > 0 ? "border-amber-500 bg-amber-500 text-black" : "border-muted-foreground/50"}`}
                                >
                                  {qty > 0 ? "✓" : ""}
                                </button>
                              ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => updateModifierQuantity(group, modifier, -1)}
                                      className="h-8 w-8 rounded-lg bg-muted font-bold text-foreground"
                                    >
                                      −
                                    </button>
                                    <span className="w-5 text-center font-black text-amber-400">{qty}</span>
                                    <button
                                      onClick={() => updateModifierQuantity(group, modifier, 1)}
                                      className="h-8 w-8 rounded-lg bg-amber-600 font-bold text-white"
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

              <div className="rounded-xl border border-border bg-secondary p-4">
                <label className="block text-xs font-bold text-muted-foreground mb-2">Notas</label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="h-16 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-amber-500 focus:outline-none"
                  placeholder="Sin hielo, extra limón..."
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary p-4">
                <span className="font-bold text-white">Cantidad</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="h-10 w-10 rounded-full bg-muted font-bold text-xl text-foreground"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xl font-black text-foreground">{itemQuantity}</span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="h-10 w-10 rounded-full bg-amber-600 font-bold text-xl text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-border p-5">
              <button
                onClick={() => setShowModifierModal(false)}
                className="flex-1 rounded-xl bg-muted py-3 font-bold text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddToCart}
                disabled={selectedItemForModifier.modifierGroups.some((g) => !isGroupValid(g.modifierGroup))}
                className="flex-[2] rounded-xl bg-amber-600 hover:bg-amber-500 py-3 font-black transition disabled:opacity-50 text-white"
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Navegación móvil — solo visible en móvil/tablet */}
      {/* ── Split Tab Modal ────────────────────────────────────────────────── */}
      {showSplitModal && parentTab && (
        <SplitTabModal
          parentTabId={parentTab.id}
          parentTabCode={parentTab.tabCode}
          orders={parentTab.orders}
          existingSubTabs={tabSubTabs}
          onClose={() => setShowSplitModal(false)}
          onDone={async () => {
            setShowSplitModal(false);
            await loadData();
          }}
        />
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-50 shadow-2xl">
        {(["tables", "menu", "account"] as const).map((tab) => {
          const icons = { tables: "🪑", menu: "🍽️", account: "🧾" };
          const labels = { tables: "MESAS", menu: "MENÚ", account: "CUENTA" };
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-[9px] font-black uppercase tracking-widest relative transition-colors  
                ${mobileTab === tab ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
            >
              {mobileTab === tab && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-b" />}
              <span className="text-xl">{icons[tab]}</span>
              {labels[tab]}
              {tab === "account" && cartBadgeCount > 0 && (
                <span className="absolute top-1 right-6 bg-primary text-white text-[9px] rounded-full min-w-[16px] h-4 flex items-center
      justify-center font-black px-1">
                  {cartBadgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
