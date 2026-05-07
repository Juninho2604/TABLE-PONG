"use client";

import { useState } from "react";
import { createSubTabAction } from "@/app/actions/subtab.actions";

interface OrderItemSummary {
  id: string;
  itemName: string;
  quantity: number;
  lineTotal: number;
}
interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  total: number;
  items: OrderItemSummary[];
}
interface OpenTabSummary {
  id: string;
  tabCode: string;
  customerLabel?: string;
  balanceDue: number;
  splitIndex?: number | null;
}

interface SplitTabModalProps {
  parentTabId: string;
  parentTabCode: string;
  orders: SalesOrderSummary[];
  existingSubTabs: OpenTabSummary[];
  onClose: () => void;
  onDone: () => Promise<void>;
}

export function SplitTabModal({
  parentTabId,
  parentTabCode,
  orders,
  existingSubTabs,
  onClose,
  onDone,
}: SplitTabModalProps) {
  const [newName, setNewName] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const grandTotal = orders.reduce((s, o) => s + o.total, 0);
  const allItems = orders.flatMap((o) => o.items);

  const handleCreate = async () => {
    if (!newName.trim()) { setError("Ingresa un nombre para la subcuenta"); return; }
    setIsCreating(true); setError("");
    const res = await createSubTabAction({ parentTabId, customerLabel: newName.trim(), guestCount });
    setIsCreating(false);
    if (!res.success) { setError(res.message || "Error creando subcuenta"); return; }
    setNewName(""); setGuestCount(1);
    await onDone();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card glass-panel w-full max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90vh] shadow-2xl border border-border">

        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg">Dividir cuenta</h3>
            <p className="text-xs text-muted-foreground">Cuenta {parentTabCode} · Total ${grandTotal.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-secondary flex items-center justify-center text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Resumen de consumos */}
          {allItems.length > 0 && (
            <div className="bg-secondary/30 rounded-2xl p-4 space-y-1.5">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">Consumos</p>
              {allItems.map((it) => (
                <div key={it.id} className="flex justify-between text-xs">
                  <span className="text-foreground/80">x{it.quantity} {it.itemName}</span>
                  <span className="text-foreground/60">${it.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Subcuentas existentes */}
          {existingSubTabs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Subcuentas activas</p>
              {existingSubTabs.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between bg-secondary/20 rounded-xl px-4 py-3 border border-border">
                  <div>
                    <span className="font-black text-sm">{sub.customerLabel || `Subcuenta ${sub.splitIndex}`}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">{sub.tabCode}</span>
                  </div>
                  <span className="font-black text-emerald-400">${sub.balanceDue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Crear nueva subcuenta */}
          <div className="space-y-3 bg-secondary/10 rounded-2xl p-4 border border-border">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nueva subcuenta</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre (ej: Alejandro, Mesa A...)"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm font-bold focus:border-primary focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-widest w-20">Personas</label>
              <div className="flex items-center gap-2 bg-secondary rounded-xl p-1 border border-border">
                <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="h-8 w-8 rounded-lg bg-card font-black hover:bg-red-500/10 hover:text-red-400">-</button>
                <span className="w-8 text-center font-black">{guestCount}</span>
                <button onClick={() => setGuestCount(guestCount + 1)} className="h-8 w-8 rounded-lg bg-primary text-primary-foreground font-black hover:opacity-90">+</button>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs font-bold">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="w-full py-3 bg-primary hover:opacity-90 rounded-xl font-black text-sm transition disabled:opacity-40"
            >
              {isCreating ? "Creando..." : "+ Crear subcuenta"}
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-border">
          <button onClick={onClose} className="w-full py-3 bg-secondary rounded-xl font-black text-sm hover:bg-muted transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
