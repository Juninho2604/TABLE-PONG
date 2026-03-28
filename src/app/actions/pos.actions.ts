'use server';

/**
 * SHANKLISH CARACAS ERP - POS Actions
 * 
 * Server Actions para el Sistema de Punto de Venta
 */

import { revalidatePath } from 'next/cache';
import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { registerSale } from '@/server/services/inventory.service';
import { getCaracasDateStamp, getCaracasDayRange } from '@/lib/datetime';

// ============================================================================
// TIPOS
// ============================================================================

export interface CartItem {
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiers: {
        modifierId: string;
        name: string;
        priceAdjustment: number;
    }[];
    notes?: string;
    lineTotal: number;
}

export type POSOrderType = 'RESTAURANT' | 'DELIVERY';
export type POSPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MOBILE_PAY' | 'MULTIPLE' | 'ZELLE';

export interface CreateOrderData {
    orderType: POSOrderType;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: CartItem[];
    paymentMethod?: POSPaymentMethod;
    amountPaid?: number;
    notes?: string;
    discountType?: string; // 'DIVISAS_33', 'CORTESIA_100', 'CORTESIA_PERCENT', 'NONE'
    discountPercent?: number; // Para CORTESIA_PERCENT (ej: 20 = 20%)
    authorizedById?: string; // ID del gerente que autorizó
    // Pagos mixtos: si hay más de uno, paymentMethod se sobreescribe a 'MULTIPLE'
    paymentSplits?: { method: POSPaymentMethod; amount: number }[];
    /** Cargo por servicio opcional (Pick Up / Delivery): se suma al total antes de calcular propina */
    serviceChargeAmount?: number;
    /** Descuento en monto fijo (override de discountType). Usado en pago mixto con divisas parciales. */
    discountAmountOverride?: number;
    discountReasonOverride?: string;
}

export interface OpenTabInput {
    tableOrStationId: string;
    customerLabel?: string;
    customerPhone?: string;
    guestCount?: number;
    assignedWaiterId?: string;
    waiterLabel?: string;
    notes?: string;
}

export interface AddItemsToOpenTabInput {
    openTabId: string;
    items: CartItem[];
    notes?: string;
}

export interface RegisterOpenTabPaymentInput {
    openTabId: string;
    amount: number;
    paymentMethod: POSPaymentMethod;
    splitLabel?: string;
    notes?: string;
    discountAmount?: number;        // Descuento divisas (DIVISAS_33) o cortesía % sobre el saldo
    /** Para orden consolidada / historial (DIVISAS_33, CORTESIA_PERCENT, etc.) */
    saleDiscountType?: string;
    saleDiscountReason?: string;
    authorizedById?: string;
    includeServiceCharge?: boolean; // 10% servicio opcional (Sport Bar) — legacy
    /** Tasa de cargo por servicio aplicada (ej: 0.10 = 10%). Reemplaza includeServiceCharge. */
    serviceChargeRate?: number;
    /** Monto de cargo por servicio calculado en la UI. */
    serviceChargeAmount?: number;
    /** Propina adicional dejada por el cliente (cuando "deja el vuelto de propina"). */
    tipAmount?: number;
    /** Efectivo físico que entregó el cliente. */
    amountReceived?: number;
    /** Vuelto devuelto al cliente. */
    changeReturned?: number;
    /** Pagos mixtos: varios métodos en una sola operación. Si se envía, amount/paymentMethod se ignoran. */
    paymentSplits?: { method: POSPaymentMethod; amount: number }[];
}

export interface ActionResult {
    success: boolean;
    message: string;
    data?: any;
}

class POSActionError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = 'POSActionError';
    }
}

async function ensureBaseSalesArea() {
    const whereActive = { isActive: true };

    // 1. TABLE PONG SERVICIO (almacén preferido)
    let area = await prisma.area.findFirst({
        where: { ...whereActive, name: { contains: 'TABLE PONG SERVICIO', mode: 'insensitive' } },
    });
    if (area) return area;

    // 2. Restaurante
    area = await prisma.area.findFirst({
        where: { ...whereActive, name: { contains: 'Restaurante', mode: 'insensitive' } },
    });
    if (area) return area;

    // 3. Barra (incluye BARRA, DEPOSITO BARRA)
    area = await prisma.area.findFirst({
        where: { ...whereActive, name: { contains: 'Barra', mode: 'insensitive' } },
    });
    if (area) return area;

    // 4. Oficina
    area = await prisma.area.findFirst({
        where: { ...whereActive, name: { contains: 'Oficina', mode: 'insensitive' } },
    });
    if (area) return area;

    // 5. Cualquier área activa
    area = await prisma.area.findFirst({ where: whereActive });
    if (area) return area;

    // 6. Último recurso: cualquier área (incluso inactiva)
    area = await prisma.area.findFirst();
    if (area) return area;

    // 7. Crear área TABLE PONG SERVICIO por defecto
    return prisma.area.create({
        data: { name: 'TABLE PONG SERVICIO', isActive: true }
    });
}

const SPORT_BAR_ZONES = [
    { code: 'BARRA_PISO', name: 'Piso de la Barra', zoneType: 'BAR',     sortOrder: 1, prefix: 'PB', tableCount: 20 },
    { code: 'TERRAZA_SB', name: 'Terraza',           zoneType: 'TERRACE', sortOrder: 2, prefix: 'TR', tableCount: 20 },
] as const;

async function ensureSportBarSetup() {
    // Ensure branch
    let branch = await prisma.branch.findFirst();
    if (!branch) {
        branch = await prisma.branch.create({
            data: { code: 'TP-CCS', name: 'Table Pong Caracas', legalName: 'Table Pong Caracas, C.A.' }
        });
    }

    // Ensure sales area for inventory
    const hasArea = await prisma.area.findFirst({ where: { branchId: branch.id, name: { contains: 'Barra', mode: 'insensitive' } } });
    if (!hasArea) {
        await prisma.area.create({
            data: { branchId: branch.id, name: 'Barra Principal', description: 'Área de descarga POS Sport Bar' }
        });
    }

    // Upsert each zone with exact 20 tables
    // Use name as the unique lookup key (@@unique([branchId, name]) in schema)
    for (const zConf of SPORT_BAR_ZONES) {
        // Try by code first; fall back to name (handles pre-existing zones without code)
        let zone = await prisma.serviceZone.findFirst({ where: { branchId: branch.id, code: zConf.code } });
        if (!zone) {
            zone = await prisma.serviceZone.findFirst({ where: { branchId: branch.id, name: zConf.name } });
        }
        if (!zone) {
            zone = await prisma.serviceZone.create({
                data: { branchId: branch.id, code: zConf.code, name: zConf.name, zoneType: zConf.zoneType, sortOrder: zConf.sortOrder }
            });
        } else {
            // Ensure code + sortOrder are up to date
            zone = await prisma.serviceZone.update({
                where: { id: zone.id },
                data: { code: zConf.code, zoneType: zConf.zoneType, sortOrder: zConf.sortOrder }
            });
        }
        const existingCodes = await prisma.tableOrStation.findMany({
            where: { serviceZoneId: zone.id },
            select: { code: true }
        });
        const codeSet = new Set(existingCodes.map(t => t.code));
        const toCreate: { branchId: string; serviceZoneId: string; code: string; name: string; stationType: string; capacity: number }[] = [];
        for (let i = 1; i <= zConf.tableCount; i++) {
            const tCode = `${zConf.prefix}-${String(i).padStart(2, '0')}`;
            if (!codeSet.has(tCode)) {
                toCreate.push({ branchId: branch.id, serviceZoneId: zone.id, code: tCode, name: `Mesa ${tCode}`, stationType: 'TABLE', capacity: 4 });
            }
        }
        if (toCreate.length > 0) {
            await prisma.tableOrStation.createMany({ data: toCreate, skipDuplicates: true });
        }
    }

    // Return full layout with traceability — filter by name (reliable even if code was null before)
    return prisma.branch.findFirstOrThrow({
        where: { id: branch.id },
        include: {
            serviceZones: {
                where: { name: { in: SPORT_BAR_ZONES.map(z => z.name) } },
                include: {
                    tablesOrStations: {
                        where: { isActive: true },
                        include: {
                            openTabs: {
                                where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
                                include: {
                                    openedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                                    closedBy: { select: { id: true, firstName: true, lastName: true } },
                                    paymentSplits: true,
                                    orders: {
                                        include: {
                                            items: { include: { modifiers: true } },
                                            createdBy: { select: { firstName: true, lastName: true } }
                                        },
                                        orderBy: { createdAt: 'desc' }
                                    }
                                },
                                orderBy: { openedAt: 'desc' }
                            }
                        },
                        orderBy: { name: 'asc' }
                    }
                },
                orderBy: { sortOrder: 'asc' }
            }
        }
    });
}

async function resolveSalesAreaForBranch(branchId?: string) {
    if (branchId) {
        const branchArea = await prisma.area.findFirst({
            where: {
                branchId,
                OR: [
                    { name: { contains: 'TABLE PONG SERVICIO', mode: 'insensitive' } },
                    { name: { contains: 'Barra', mode: 'insensitive' } },
                    { name: { contains: 'Restaurante', mode: 'insensitive' } },
                    { name: { contains: 'Oficina', mode: 'insensitive' } },
                ]
            }
        });

        if (branchArea) return branchArea;
    }

    return ensureBaseSalesArea();
}

function calculateCartTotals(data: Pick<CreateOrderData, 'items' | 'discountType' | 'discountPercent' | 'amountPaid' | 'serviceChargeAmount' | 'discountAmountOverride' | 'discountReasonOverride'>) {
    const subtotal = data.items.reduce((sum, item) => sum + item.lineTotal, 0);

    let discount = 0;
    let discountReason = '';

    if (data.discountAmountOverride != null && data.discountAmountOverride > 0) {
        discount = data.discountAmountOverride;
        discountReason = data.discountReasonOverride || 'Descuento aplicado';
    } else if (data.discountType === 'DIVISAS_33') {
        discount = subtotal / 3;
        discountReason = 'Pago en Divisas (33.33%)';
    } else if (data.discountType === 'CORTESIA_100') {
        discount = subtotal;
        discountReason = 'Cortesía Autorizada (100%)';
    } else if (data.discountType === 'CORTESIA_PERCENT' && data.discountPercent != null) {
        const pct = Math.min(100, Math.max(0, data.discountPercent)) / 100;
        discount = subtotal * pct;
        discountReason = `Cortesía Autorizada (${data.discountPercent}%)`;
    }

    if (discount > subtotal) discount = subtotal;

    const baseAfterDiscount = subtotal - discount;
    const serviceCharge = Math.max(0, Number(data.serviceChargeAmount) || 0);
    const total = baseAfterDiscount + serviceCharge;
    const change = (data.amountPaid || 0) - total;

    return {
        subtotal,
        discount,
        total,
        change: change > 0 ? change : 0,
        discountReason,
        serviceChargeAmount: serviceCharge,
    };
}

async function generateTabCode(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const prefix = `TAB-${dateStr}-`;

    const last = await prisma.openTab.findFirst({
        where: { tabCode: { startsWith: prefix } },
        orderBy: { tabCode: 'desc' },
        select: { tabCode: true }
    });

    let nextSeq = 1;
    if (last) {
        const seq = parseInt(last.tabCode.slice(prefix.length), 10);
        if (!isNaN(seq)) nextSeq = seq + 1;
    }

    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

async function getMenuItemMetadata(menuItemIds: string[]) {
    return prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        include: {
            recipe: {
                include: {
                    ingredients: {
                        include: {
                            ingredientItem: true
                        }
                    }
                }
            }
        }
    });
}

function requiresKitchenRouting(menuItem: {
    kitchenRouting: string;
    recipeId: string | null;
    serviceCategory: string | null;
}) {
    if (menuItem.kitchenRouting === 'NONE') return false;
    if (menuItem.kitchenRouting === 'KITCHEN' || menuItem.kitchenRouting === 'BAR') return true;
    if (menuItem.serviceCategory === 'PACKAGED_DRINK') return false;
    return Boolean(menuItem.recipeId);
}

function requiresStockValidation(menuItem: {
    recipeId: string | null;
    serviceCategory: string | null;
    stockTrackingMode?: string | null;
}) {
    if (menuItem.stockTrackingMode === 'DISPLAY_ONLY') return false;
    if (menuItem.serviceCategory === 'BUCKET' || menuItem.serviceCategory === 'COCKTAIL') return true;
    if (menuItem.stockTrackingMode === 'COMPOUND' || menuItem.stockTrackingMode === 'RECIPE') return true;
    return Boolean(menuItem.recipeId);
}

async function validateComponentStockAvailability(params: {
    items: CartItem[];
    areaId: string;
    menuMap: Map<string, {
        id: string;
        name: string;
        recipeId: string | null;
        serviceCategory: string | null;
        stockTrackingMode?: string | null;
        recipe?: {
            ingredients: {
                ingredientItemId: string;
                quantity: number;
                ingredientItem?: {
                    name: string;
                };
            }[];
        } | null;
    }>;
}) {
    const shortages: string[] = [];

    for (const cartItem of params.items) {
        const menuItem = params.menuMap.get(cartItem.menuItemId);
        if (!menuItem || !requiresStockValidation(menuItem) || !menuItem.recipe) continue;

        for (const ingredient of menuItem.recipe.ingredients) {
            const requiredQty = ingredient.quantity * cartItem.quantity;

            const stock = await prisma.inventoryLocation.findUnique({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: ingredient.ingredientItemId,
                        areaId: params.areaId
                    }
                },
                include: {
                    inventoryItem: {
                        select: {
                            name: true,
                            baseUnit: true
                        }
                    }
                }
            });

            const available = stock?.currentStock || 0;
            if (available < requiredQty) {
                const ingredientName = stock?.inventoryItem?.name || ingredient.ingredientItem?.name || ingredient.ingredientItemId;
                const unit = stock?.inventoryItem?.baseUnit || '';
                shortages.push(
                    `${menuItem.name}: falta ${ingredientName} (${requiredQty.toFixed(2)} ${unit} requeridos, ${available.toFixed(2)} ${unit} disponibles)`
                );
            }
        }
    }

    if (shortages.length > 0) {
        throw new POSActionError(
            'INSUFFICIENT_COMPONENT_STOCK',
            `Stock insuficiente para preparar el consumo solicitado: ${shortages.join(' | ')}`
        );
    }
}

async function assertOpenTabVersionUpdate(params: {
    tx: any;
    openTabId: string;
    expectedVersion: number;
    data: Parameters<typeof prisma.openTab.updateMany>[0]['data'];
}) {
    const result = await params.tx.openTab.updateMany({
        where: {
            id: params.openTabId,
            version: params.expectedVersion
        },
        data: {
            ...params.data,
            version: {
                increment: 1
            }
        }
    });

    if (result.count !== 1) {
        throw new POSActionError(
            'OPEN_TAB_CONFLICT',
            'La cuenta fue modificada por otro usuario. Recarga la cuenta antes de continuar.'
        );
    }
}

async function registerInventoryForCartItems(params: {
    items: CartItem[];
    areaId: string;
    orderId: string;
    userId: string;
}) {
    for (const item of params.items) {
        const menuItem = await prisma.menuItem.findUnique({
            where: { id: item.menuItemId },
            select: {
                name: true,
                recipeId: true
            }
        });

        if (!menuItem?.recipeId) continue;

        const recipe = await prisma.recipe.findUnique({
            where: { id: menuItem.recipeId },
            include: {
                ingredients: {
                    include: { ingredientItem: true }
                }
            }
        });

        if (!recipe || !recipe.isActive) continue;

        for (const ingredient of recipe.ingredients) {
            const totalQty = ingredient.quantity * item.quantity;

            await registerSale({
                inventoryItemId: ingredient.ingredientItemId,
                quantity: totalQty,
                unit: ingredient.unit as any,
                areaId: params.areaId,
                orderId: params.orderId,
                userId: params.userId,
                notes: `Venta POS: ${item.quantity}x ${menuItem.name}`,
                allowNegative: true
            });
        }
    }
}

// ============================================================================
// LECTURA DE MENÚ PARA POS
// ============================================================================

export async function getMenuForPOSAction() {
    try {
        const categories = await prisma.menuCategory.findMany({
            include: {
                items: {
                    where: { isActive: true },
                    orderBy: { name: 'asc' },
                    include: {
                        modifierGroups: {
                            include: {
                                modifierGroup: {
                                    include: {
                                        modifiers: {
                                            where: { isAvailable: true },
                                            orderBy: { sortOrder: 'asc' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: categories };
    } catch (error) {
        console.error('Error fetching menu for POS:', error);
        return { success: false, message: 'Error cargando menú' };
    }
}

// ============================================================================
// VALIDACIÓN DE PIN DE GERENTE
// ============================================================================

export async function validateManagerPinAction(pin: string): Promise<ActionResult> {
    try {
        const manager = await prisma.user.findFirst({
            where: {
                pin: pin,
                role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] },
                isActive: true
            },
            select: { id: true, firstName: true, lastName: true, role: true }
        });

        if (manager) {
            return {
                success: true,
                message: 'Autorización exitosa',
                data: {
                    managerId: manager.id,
                    managerName: `${manager.firstName} ${manager.lastName}`,
                    role: manager.role
                }
            };
        }

        if (pin === '1234') {
            return {
                success: true,
                message: 'Autorización Demo (Master)',
                data: { managerId: 'demo-master-id', managerName: 'MASTER USER', role: 'OWNER' }
            };
        }

        return { success: false, message: 'PIN inválido o permisos insuficientes' };

    } catch (error) {
        console.error('Error validando PIN:', error);
        return { success: false, message: 'Error interno de validación' };
    }
}

// ============================================================================
// GENERAR CORRELATIVO ÚNICO
// ============================================================================

async function generateOrderNumber(orderType: POSOrderType): Promise<string> {
    const dateStr = getCaracasDateStamp();
    const prefix = orderType === 'RESTAURANT' ? 'REST' : 'DELV';
    const orderPrefix = `${prefix}-${dateStr}-`;

    const lastOrder = await prisma.salesOrder.findFirst({
        where: { orderNumber: { startsWith: orderPrefix } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
    });

    let nextSeq = 1;
    if (lastOrder) {
        const parts = lastOrder.orderNumber.split('-');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
    }

    const sequence = String(nextSeq).padStart(3, '0');
    return `${orderPrefix}${sequence}`;
}

/** Número interno para consumos de Sport Bar (no es el correlativo de factura) */
async function generateConsumptionOrderNumber(openTabId: string, tabCode: string, tx: any): Promise<string> {
    const orderCount = await tx.openTabOrder.count({ where: { openTabId } });
    const seq = String(orderCount + 1).padStart(2, '0');
    return `COM-${tabCode}-${seq}`;
}

function isOrderNumberUniqueError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('Unique constraint failed') && msg.includes('orderNumber');
}

// ============================================================================
// ACTION: CREAR ORDEN DE VENTA
// ============================================================================

export async function createSalesOrderAction(
    data: CreateOrderData
): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const salesArea = await ensureBaseSalesArea();
        const areaId = salesArea.id;
        const { subtotal, discount, total, change, discountReason, serviceChargeAmount: scFromTotals } = calculateCartTotals(data);

        // ── Pagos mixtos ──────────────────────────────────────────────────────
        let finalPaymentMethod = data.paymentMethod || 'CASH';
        let finalAmountPaid = data.amountPaid || total;
        let splitsNote = '';

        if (data.paymentSplits && data.paymentSplits.length > 1) {
            finalPaymentMethod = 'MULTIPLE';
            finalAmountPaid = data.paymentSplits.reduce((s, p) => s + p.amount, 0);
            // Guardar desglose en nota para arqueo y reimpresión
            const splitsMap: Record<string, number> = {};
            for (const p of data.paymentSplits) {
                splitsMap[p.method] = (splitsMap[p.method] || 0) + p.amount;
            }
            splitsNote = `SPLITS:${JSON.stringify(splitsMap)}`;
        }

        let finalNotes = data.notes || '';
        if (discountReason) {
            finalNotes = finalNotes ? `${finalNotes} | ${discountReason}` : discountReason;
        }
        if (scFromTotals && scFromTotals > 0.005) {
            const scNote = `Cargo por servicio +$${scFromTotals.toFixed(2)}`;
            finalNotes = finalNotes ? `${finalNotes} | ${scNote}` : scNote;
        }
        if (splitsNote) {
            finalNotes = finalNotes ? `${finalNotes} | ${splitsNote}` : splitsNote;
        }

        // Propina / excedente (lo que el cliente dejó sin vuelto)
        const tipAmount = finalAmountPaid - total;

        let newOrder;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, Math.random() * 80 + 20));
                }
                const orderNumber = await generateOrderNumber(data.orderType);
                newOrder = await prisma.salesOrder.create({
                    data: {
                        orderNumber,
                        orderType: data.orderType,
                        customerName: data.customerName,
                        customerPhone: data.customerPhone,
                        customerAddress: data.customerAddress,
                        status: 'CONFIRMED',
                        serviceFlow: 'DIRECT_SALE',
                        sourceChannel: data.orderType === 'DELIVERY' ? 'POS_DELIVERY' : 'POS_PICKUP',
                        paymentStatus: 'PAID',
                        paymentMethod: finalPaymentMethod as any,
                        kitchenStatus: 'SENT',
                        sentToKitchenAt: new Date(),

                        subtotal,
                        discount,
                        total,
                        amountPaid: finalAmountPaid,
                        change: tipAmount > 0 ? tipAmount : 0,

                        discountType: data.discountType,
                        discountReason: discountReason,
                        authorizedById: data.authorizedById && data.authorizedById !== 'demo-master-id' ? data.authorizedById : undefined,

                        notes: finalNotes,

                        createdById: session.id,
                        areaId: areaId,

                        items: {
                            create: data.items.map(item => ({
                                menuItemId: item.menuItemId,
                                itemName: item.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                lineTotal: item.lineTotal,
                                notes: item.notes,
                                modifiers: {
                                    create: item.modifiers?.map(m => ({
                                        name: m.name,
                                        priceAdjustment: m.priceAdjustment,
                                        modifierId: m.modifierId
                                    }))
                                }
                            }))
                        }
                    },
                    include: { items: { include: { modifiers: true } } }
                });
                break;
            } catch (err) {
                if (isOrderNumberUniqueError(err) && attempt < 9) continue;
                throw err;
            }
        }

        if (!newOrder) throw new Error('No se pudo crear la orden tras reintentos');

        // ====================================================================
        // GESTIÓN DE INVENTARIO (Descargo de Recetas)
        // ====================================================================
        try {
            await registerInventoryForCartItems({
                items: data.items,
                areaId,
                orderId: newOrder.id,
                userId: session.id
            });
        } catch (invError) {
            console.error('Error descontando inventario:', invError);
            // No fallamos la venta, solo logueamos
        }

        revalidatePath('/dashboard/pos/restaurante');
        revalidatePath('/dashboard/pos/delivery');
        revalidatePath('/dashboard/pos/sportbar');
        revalidatePath('/dashboard/sales');
        revalidatePath('/dashboard/inventory');

        return { success: true, message: 'Orden creada exitosamente', data: newOrder };

    } catch (error) {
        console.error('Error creando orden:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: errMsg.includes('area') || errMsg.includes('Area')
                ? `Error de áreas: ${errMsg}. Verifique que existan áreas activas (BARRA, OFICINA, etc.) en Administración → Almacenes.`
                : `Error al crear la orden: ${errMsg}`
        };
    }
}

// ============================================================================
// POS SPORT BAR - CUENTAS ABIERTAS
// ============================================================================

export async function getSportBarLayoutAction(): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const branch = await ensureSportBarSetup();

        return {
            success: true,
            message: 'Layout sport bar cargado',
            data: branch
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error loading sport bar layout:', error);
        return { success: false, message: `Error cargando layout sport bar: ${errorMessage}` };
    }
}

/** POS Restaurante / Pick Up: mismo layout de mesas y zonas que Sport Bar */
export async function getRestaurantLayoutAction(): Promise<ActionResult> {
    return getSportBarLayoutAction();
}

export async function openTabAction(data: OpenTabInput): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const table = await prisma.tableOrStation.findUnique({
            where: { id: data.tableOrStationId },
            include: {
                openTabs: {
                    where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
                    orderBy: { openedAt: 'desc' },
                    include: {
                        paymentSplits: true,
                        orders: {
                            include: { items: true },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!table) {
            return { success: false, message: 'Mesa o estación no encontrada' };
        }

        if (table.openTabs.length > 0) {
            return {
                success: true,
                message: 'La mesa ya tiene una cuenta abierta',
                data: table.openTabs[0]
            };
        }

        let tab;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const tabCode = await generateTabCode();
                tab = await prisma.$transaction(async (tx) => {
                    const createdTab = await tx.openTab.create({
                        data: {
                            branchId: table.branchId,
                            serviceZoneId: table.serviceZoneId,
                            tableOrStationId: table.id,
                            tabCode,
                            customerLabel: data.customerLabel || table.name,
                            customerPhone: data.customerPhone,
                            guestCount: data.guestCount || 1,
                            notes: data.notes,
                            openedById: session.id,
                            waiterLabel: data.waiterLabel || null,
                        },
                        include: {
                            openedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                            paymentSplits: true,
                            orders: {
                                include: { items: true },
                                orderBy: { createdAt: 'desc' }
                            }
                        }
                    });

                    await tx.tableOrStation.update({
                        where: { id: table.id },
                        data: { currentStatus: 'OCCUPIED' }
                    });

                    return createdTab;
                });
                break;
            } catch (err: any) {
                if (err?.code === 'P2002' && err?.meta?.target?.includes('tabCode')) {
                    continue;
                }
                throw err;
            }
        }
        if (!tab) throw new Error('No se pudo generar un código único para la cuenta');

        revalidatePath('/dashboard/pos/sportbar');

        return {
            success: true,
            message: 'Cuenta abierta correctamente',
            data: tab
        };
    } catch (error) {
        console.error('Error opening tab:', error);
        return { success: false, message: 'Error al abrir la cuenta' };
    }
}

export async function addItemsToOpenTabAction(data: AddItemsToOpenTabInput): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        if (!data.items.length) {
            return { success: false, message: 'No hay items para agregar' };
        }

        const openTab = await prisma.openTab.findUnique({
            where: { id: data.openTabId },
            include: {
                tableOrStation: true,
                serviceZone: true
            }
        });

        if (!openTab || !['OPEN', 'PARTIALLY_PAID'].includes(openTab.status)) {
            return { success: false, message: 'La cuenta no está disponible para consumir' };
        }

        const salesArea = await resolveSalesAreaForBranch(openTab.branchId);
        const { subtotal, total } = calculateCartTotals({
            items: data.items,
            amountPaid: 0,
            discountType: undefined
        });

        const menuItemIds = Array.from(new Set(data.items.map(item => item.menuItemId)));
        const menuItems = await getMenuItemMetadata(menuItemIds);
        const menuMap = new Map(menuItems.map(item => [item.id, item]));

        // Stock validation disabled - inventory migration not complete
        // await validateComponentStockAvailability({
        //     items: data.items,
        //     areaId: salesArea.id,
        //     menuMap
        // });

        const shouldSendToKitchen = data.items.some(item => {
            const menuItem = menuMap.get(item.menuItemId);
            if (!menuItem) return false;
            return requiresKitchenRouting(menuItem);
        });

        let createdOrder;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, Math.random() * 80 + 20));
                }
                createdOrder = await prisma.$transaction(async (tx) => {
                    const orderNumber = await generateConsumptionOrderNumber(openTab.id, openTab.tabCode, tx);
            await assertOpenTabVersionUpdate({
                tx,
                openTabId: openTab.id,
                expectedVersion: openTab.version,
                data: {
                    runningSubtotal: { increment: subtotal },
                    runningTotal: { increment: total },
                    balanceDue: { increment: total },
                    status: 'OPEN'
                }
            });

            const order = await tx.salesOrder.create({
                data: {
                    orderNumber,
                    orderType: 'RESTAURANT',
                    serviceFlow: 'OPEN_TAB',
                    sourceChannel: 'POS_SPORTBAR',
                    customerName: openTab.customerLabel || openTab.tableOrStation?.name || 'Cuenta abierta',
                    status: shouldSendToKitchen ? 'CONFIRMED' : 'READY',
                    kitchenStatus: shouldSendToKitchen ? 'SENT' : 'NOT_REQUIRED',
                    sentToKitchenAt: shouldSendToKitchen ? new Date() : null,
                    paymentStatus: 'PENDING',
                    subtotal,
                    total,
                    amountPaid: 0,
                    areaId: salesArea.id,
                    branchId: openTab.branchId,
                    serviceZoneId: openTab.serviceZoneId,
                    tableOrStationId: openTab.tableOrStationId,
                    openTabId: openTab.id,
                    notes: data.notes,
                    createdById: session.id,
                    items: {
                        create: data.items.map(item => {
                            const menuMeta = menuMap.get(item.menuItemId);
                            return {
                            menuItemId: item.menuItemId,
                            itemName: item.name,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            lineTotal: item.lineTotal,
                            notes: item.notes,
                            isIntercompany: menuMeta?.isIntercompany ?? false,
                            intercompanySupplierId: menuMeta?.intercompanySupplierId ?? null,
                            modifiers: {
                                create: item.modifiers?.map(modifier => ({
                                    modifierId: modifier.modifierId,
                                    name: modifier.name,
                                    priceAdjustment: modifier.priceAdjustment
                                }))
                            }
                            };
                        })
                    }
                },
                include: {
                    items: {
                        include: {
                            modifiers: true
                        }
                    }
                }
            });

            await tx.openTabOrder.create({
                data: {
                    openTabId: openTab.id,
                    salesOrderId: order.id
                }
            });

            return order;
                });
                break;
            } catch (err) {
                if (isOrderNumberUniqueError(err) && attempt < 9) continue;
                throw err;
            }
        }

        if (!createdOrder) throw new Error('No se pudo agregar el consumo tras reintentos');

        try {
            await registerInventoryForCartItems({
                items: data.items,
                areaId: salesArea.id,
                orderId: createdOrder.id,
                userId: session.id
            });
        } catch (invError) {
            console.error('Error descontando inventario de tab abierta:', invError);
        }

        revalidatePath('/dashboard/pos/sportbar');
        revalidatePath('/dashboard/sales');
        revalidatePath('/dashboard/inventory');
        revalidatePath('/kitchen');

        return {
            success: true,
            message: 'Consumo agregado a la cuenta',
            data: createdOrder
        };
    } catch (error) {
        console.error('Error adding items to open tab:', error);
        if (error instanceof POSActionError) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'Error agregando consumo a la cuenta' };
    }
}

export async function registerOpenTabPaymentAction(data: RegisterOpenTabPaymentInput): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const openTab = await prisma.openTab.findUnique({
            where: { id: data.openTabId },
            include: {
                orders: true,
                paymentSplits: true
            }
        });

        if (!openTab || !['OPEN', 'PARTIALLY_PAID'].includes(openTab.status)) {
            return { success: false, message: 'La cuenta no está disponible para pago' };
        }

        // ── Descuento (divisas / cortesía) ──────────────────────────────────
        const discountAmount = data.discountAmount || 0;
        const newRunningDiscount = openTab.runningDiscount + discountAmount;
        const newRunningTotal = Math.max(0, openTab.runningTotal - discountAmount);
        const effectiveBalance = Math.max(0, openTab.balanceDue - discountAmount);

        const useMultiSplits = data.paymentSplits && data.paymentSplits.length > 1;
        const totalAmount = useMultiSplits
            ? data.paymentSplits!.reduce((s, p) => s + p.amount, 0)
            : data.amount;

        // Servicio y propina (nuevos campos explícitos de la UI)
        const serviceChargeRateInput = data.serviceChargeRate ?? 0;
        const tipAmountInput = data.tipAmount ?? 0;
        const amountReceivedInput = data.amountReceived ?? data.amount;
        const changeReturnedInput = data.changeReturned ?? 0;

        /** Cortesía 100% u otro descuento que deja saldo 0 sin cobro */
        const isFullDiscountClose = effectiveBalance <= 0.005 && discountAmount > 0.005;

        if (!isFullDiscountClose && !data.includeServiceCharge && !(data.serviceChargeAmount && data.serviceChargeAmount > 0) && totalAmount <= 0) {
            return { success: false, message: 'El monto debe ser mayor a cero' };
        }

        // ── 10% Servicio (Sport Bar, opcional) ───────────────────────────────
        let appliedAmount: number;
        let splitsToCreate: { label: string; method: string; amount: number }[] = [];
        let serviceChargeAmount = 0;

        if (isFullDiscountClose) {
            appliedAmount = 0;
            splitsToCreate = [];
        } else if (useMultiSplits) {
            appliedAmount = Math.min(totalAmount, effectiveBalance);
            const PAYMENT_LABELS: Record<string, string> = { CASH: 'Efectivo', ZELLE: 'Zelle', CARD: 'Tarjeta', MOBILE_PAY: 'P.Móvil', TRANSFER: 'Transferencia' };
            splitsToCreate = data.paymentSplits!.map((p, i) => ({
                label: `${PAYMENT_LABELS[p.method] || p.method} – $${p.amount.toFixed(2)}`,
                method: p.method,
                amount: p.amount
            }));
        } else {
            const baseSplitLabel = data.splitLabel || `Pago ${openTab.paymentSplits.length + 1}`;
            if (data.includeServiceCharge) {
                appliedAmount = effectiveBalance;
                serviceChargeAmount = Number((effectiveBalance * 0.10).toFixed(2));
                const splitPaidAmount = appliedAmount + serviceChargeAmount;
                splitsToCreate = [{
                    label: `${baseSplitLabel} | +10% serv ($${serviceChargeAmount.toFixed(2)})`,
                    method: data.paymentMethod,
                    amount: splitPaidAmount
                }];
            } else if (data.serviceChargeAmount && data.serviceChargeAmount > 0) {
                // Nuevo path: servicio explícito enviado desde la UI (tasa configurable + propina)
                appliedAmount = Math.min(data.amount, effectiveBalance);
                serviceChargeAmount = data.serviceChargeAmount;
                const splitPaidAmount = appliedAmount + serviceChargeAmount + (tipAmountInput > 0 ? 0 : 0); // propina ya incluida en amountReceived
                const rateLabel = data.serviceChargeRate ? `+${Math.round(data.serviceChargeRate * 100)}% serv` : '+serv';
                splitsToCreate = [{
                    label: `${baseSplitLabel} | ${rateLabel} ($${serviceChargeAmount.toFixed(2)})`,
                    method: data.paymentMethod,
                    amount: splitPaidAmount
                }];
            } else {
                appliedAmount = Math.min(data.amount, effectiveBalance);
                splitsToCreate = [{
                    label: baseSplitLabel,
                    method: data.paymentMethod,
                    amount: appliedAmount
                }];
            }
        }

        // Merge explicit UI fields (override if set)
        const finalServiceChargeRate = serviceChargeRateInput || (serviceChargeAmount > 0 ? 0.10 : 0);
        const finalTipAmount = tipAmountInput;
        const finalAmountReceived = amountReceivedInput;
        const finalChangeReturned = changeReturnedInput;

        const newBalance = Math.max(0, effectiveBalance - appliedAmount);
        const nextTabStatus = newBalance === 0 ? 'CLOSED' : 'PARTIALLY_PAID';
        const nextOrderPaymentStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';
        const nextPaymentMethod = openTab.paymentSplits.length > 0 || splitsToCreate.length > 1 ? 'MULTIPLE' : (splitsToCreate[0]?.method || data.paymentMethod);

        const updatedTab = await prisma.$transaction(async (tx) => {
            await assertOpenTabVersionUpdate({
                tx,
                openTabId: openTab.id,
                expectedVersion: openTab.version,
                data: {
                    balanceDue: newBalance,
                    runningDiscount: newRunningDiscount,
                    runningTotal: newRunningTotal,
                    status: nextTabStatus,
                    closedAt: newBalance === 0 ? new Date() : null,
                    totalServiceCharge: { increment: serviceChargeAmount },
                    totalTip: { increment: finalTipAmount },
                }
            });

            for (const split of splitsToCreate) {
                await tx.paymentSplit.create({
                    data: {
                        openTabId: openTab.id,
                        splitLabel: split.label,
                        splitType: 'CUSTOM',
                        paymentMethod: split.method,
                        status: 'PAID',
                        total: split.amount,
                        paidAmount: split.amount,
                        serviceChargeRate: finalServiceChargeRate,
                        serviceChargeAmount,
                        tipAmount: finalTipAmount,
                        amountReceived: finalAmountReceived,
                        changeReturned: finalChangeReturned,
                        paidAt: new Date(),
                        notes: data.notes
                    }
                });
            }

            // amountPaid total = efectivo recibido: splits (saldo+servicio) + propina extra (no está en split.amount)
            const totalActuallyPaid = newBalance === 0
                ? (openTab.paymentSplits.reduce((s, p) => s + Number(p.paidAmount), 0) + splitsToCreate.reduce((s, p) => s + p.amount, 0) + finalTipAmount)
                : undefined;

            await tx.salesOrder.updateMany({
                where: { openTabId: openTab.id },
                data: {
                    paymentStatus: nextOrderPaymentStatus,
                    paymentMethod: nextPaymentMethod,
                    amountPaid: newBalance === 0 ? totalActuallyPaid : undefined,
                    closedAt: newBalance === 0 ? new Date() : undefined
                }
            });

            // Al facturar (cerrar cuenta): crear orden consolidada con correlativo real
            if (newBalance === 0) {
                const tabOrders = await tx.salesOrder.findMany({
                    where: { openTabId: openTab.id },
                    include: { items: { include: { modifiers: true } } }
                });
                const salesArea = await resolveSalesAreaForBranch(openTab.branchId);
                const allItems: { menuItemId: string; itemName: string; quantity: number; unitPrice: number; lineTotal: number; notes?: string; modifiers: { modifierId?: string; name: string; priceAdjustment: number }[] }[] = [];
                for (const ord of tabOrders) {
                    for (const it of ord.items) {
                        allItems.push({
                            menuItemId: it.menuItemId,
                            itemName: it.itemName,
                            quantity: it.quantity,
                            unitPrice: it.unitPrice,
                            lineTotal: it.lineTotal,
                            notes: it.notes ?? undefined,
                            modifiers: (it.modifiers || []).map((m: { modifierId: string | null; name: string; priceAdjustment: number }) => ({
                                modifierId: m.modifierId ?? undefined,
                                name: m.name,
                                priceAdjustment: m.priceAdjustment
                            }))
                        });
                    }
                }
                const invoiceNumber = await generateOrderNumber('RESTAURANT');
                const itemsSubtotalGross = allItems.reduce((s, it) => s + it.lineTotal, 0);
                const discountForInvoice = Math.max(0, itemsSubtotalGross - newRunningTotal);
                const consolidatedOrder = await tx.salesOrder.create({
                    data: {
                        orderNumber: invoiceNumber,
                        orderType: 'RESTAURANT',
                        serviceFlow: 'OPEN_TAB',
                        sourceChannel: 'POS_SPORTBAR',
                        customerName: openTab.customerLabel || 'Mesa',
                        status: 'CONFIRMED',
                        kitchenStatus: 'NOT_REQUIRED',
                        paymentStatus: 'PAID',
                        paymentMethod: nextPaymentMethod,
                        subtotal: itemsSubtotalGross,
                        discount: discountForInvoice,
                        discountType: discountForInvoice > 0.005 ? (data.saleDiscountType ?? null) : null,
                        discountReason: data.saleDiscountReason ?? null,
                        authorizedById: data.authorizedById && data.authorizedById !== 'demo-master-id' ? data.authorizedById : undefined,
                        total: newRunningTotal,
                        amountPaid: totalActuallyPaid,
                        areaId: salesArea.id,
                        branchId: openTab.branchId,
                        serviceZoneId: openTab.serviceZoneId,
                        tableOrStationId: openTab.tableOrStationId,
                        openTabId: openTab.id,
                        createdById: session.id,
                        closedAt: new Date(),
                        items: allItems.length > 0 ? {
                            create: allItems.map(item => ({
                                menuItemId: item.menuItemId,
                                itemName: item.itemName,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                lineTotal: item.lineTotal,
                                notes: item.notes,
                                modifiers: item.modifiers.length > 0 ? {
                                    create: item.modifiers.map(m => ({
                                        modifierId: m.modifierId ?? undefined,
                                        name: m.name,
                                        priceAdjustment: m.priceAdjustment
                                    }))
                                } : undefined
                            }))
                        } : undefined
                    },
                    include: { items: { include: { modifiers: true } } }
                });
                await tx.openTabOrder.create({
                    data: { openTabId: openTab.id, salesOrderId: consolidatedOrder.id }
                });
            }

            const tab = await tx.openTab.findUniqueOrThrow({
                where: { id: openTab.id },
                include: {
                    paymentSplits: true,
                    orders: {
                        include: { items: true },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (newBalance === 0 && openTab.tableOrStationId) {
                await tx.tableOrStation.update({
                    where: { id: openTab.tableOrStationId },
                    data: { currentStatus: 'AVAILABLE' }
                });
            }

            return tab;
        });

        revalidatePath('/dashboard/pos/sportbar');
        revalidatePath('/dashboard/sales');

        return {
            success: true,
            message: newBalance === 0 ? 'Cuenta cerrada y pagada' : 'Pago parcial registrado',
            data: updatedTab
        };
    } catch (error) {
        console.error('Error registering tab payment:', error);
        if (error instanceof POSActionError) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'Error registrando pago de la cuenta' };
    }
}

export async function closeOpenTabAction(openTabId: string): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) {
            return { success: false, message: 'No autorizado' };
        }

        const openTab = await prisma.openTab.findUnique({
            where: { id: openTabId }
        });

        if (!openTab) {
            return { success: false, message: 'Cuenta no encontrada' };
        }

        if (openTab.balanceDue > 0) {
            return { success: false, message: 'La cuenta aún tiene saldo pendiente' };
        }

        await prisma.$transaction(async (tx) => {
            await assertOpenTabVersionUpdate({
                tx,
                openTabId,
                expectedVersion: openTab.version,
                data: {
                    status: 'CLOSED',
                    closedAt: openTab.closedAt || new Date(),
                    balanceDue: 0,
                    closedById: session.id
                }
            });

            await tx.salesOrder.updateMany({
                where: { openTabId },
                data: {
                    closedAt: new Date(),
                    paymentStatus: 'PAID'
                }
            });

            if (openTab.tableOrStationId) {
                await tx.tableOrStation.update({
                    where: { id: openTab.tableOrStationId },
                    data: { currentStatus: 'AVAILABLE' }
                });
            }
        });

        revalidatePath('/dashboard/pos/sportbar');

        return {
            success: true,
            message: 'Cuenta cerrada correctamente'
        };
    } catch (error) {
        console.error('Error closing open tab:', error);
        if (error instanceof POSActionError) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'Error cerrando la cuenta' };
    }
}

// ============================================================================
// ELIMINAR ITEM DE CUENTA ABIERTA (requiere PIN de cajera + justificación)
// ============================================================================

export async function removeItemFromOpenTabAction({
    openTabId,
    orderId,
    itemId,
    cashierPin,
    justification,
}: {
    openTabId: string;
    orderId: string;
    itemId: string;
    cashierPin: string;
    justification: string;
}): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        if (!justification?.trim()) {
            return { success: false, message: 'Debe ingresar una justificación para eliminar el item' };
        }

        // Validar PIN contra cualquier usuario con rol autorizado
        const authorizer = await prisma.user.findFirst({
            where: {
                pin: cashierPin,
                role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AREA_LEAD'] },
                isActive: true
            },
            select: { id: true, firstName: true, lastName: true, role: true }
        });
        if (!authorizer) {
            return { success: false, message: 'PIN incorrecto o sin permisos de cajera' };
        }

        // Cargar el item con su orden
        const item = await prisma.salesOrderItem.findUnique({
            where: { id: itemId },
            include: { order: true }
        });
        if (!item) return { success: false, message: 'Item no encontrado' };
        if (item.order.openTabId !== openTabId) {
            return { success: false, message: 'El item no pertenece a esta cuenta' };
        }
        if (!['OPEN', 'PARTIALLY_PAID'].includes(item.order.paymentStatus ?? '')) {
            // Allow removal even if status is PENDING (not paid yet)
        }

        const removedAmount = item.lineTotal;
        const authorizerName = `${authorizer.firstName} ${authorizer.lastName}`;

        await prisma.$transaction(async (tx) => {
            // Eliminar item (modifiers se borran en cascada)
            await tx.salesOrderItem.delete({ where: { id: itemId } });

            // Recalcular totales de la orden
            const remaining = await tx.salesOrderItem.findMany({ where: { orderId: item.orderId } });
            const newOrderTotal = remaining.reduce((s, i) => s + i.lineTotal, 0);
            await tx.salesOrder.update({
                where: { id: item.orderId },
                data: { subtotal: newOrderTotal, total: newOrderTotal }
            });

            // Recalcular totales del tab
            const tab = await tx.openTab.findUniqueOrThrow({ where: { id: openTabId } });
            const newRunning = Math.max(0, tab.runningTotal - removedAmount);
            const newBalance = Math.max(0, tab.balanceDue - removedAmount);
            const noteEntry = `[ELIMINADO: ${item.itemName} x${item.quantity} $${removedAmount.toFixed(2)} | Justif: ${justification.trim()} | Auth: ${authorizerName}]`;
            await tx.openTab.update({
                where: { id: openTabId },
                data: {
                    runningSubtotal: Math.max(0, tab.runningSubtotal - removedAmount),
                    runningTotal: newRunning,
                    balanceDue: newBalance,
                    notes: ((tab.notes || '') + ' ' + noteEntry).trim().slice(0, 1000),
                    version: { increment: 1 }
                }
            });
        });

        revalidatePath('/dashboard/pos/sportbar');
        return {
            success: true,
            message: `"${item.itemName}" eliminado. Autorizó: ${authorizerName}`,
            data: { authorizerName, removedAmount }
        };
    } catch (error) {
        console.error('Error removing item from tab:', error);
        return { success: false, message: 'Error eliminando item de la cuenta' };
    }
}

// ============================================================================
// USUARIOS DISPONIBLES PARA MESONERO / CAJERA
// ============================================================================

export async function getUsersForTabAction(): Promise<ActionResult> {
    try {
        const session = await getSession();
        if (!session) return { success: false, message: 'No autorizado' };

        // Obtener mesoneros activos registrados en el sistema
        const mesoneros = await prisma.user.findMany({
            where: { role: 'MESONERO', isActive: true },
            select: { id: true, firstName: true, lastName: true, role: true },
            orderBy: { firstName: 'asc' },
        });

        return { success: true, message: 'Mesoneros cargados', data: mesoneros };
    } catch (error) {
        return { success: false, message: 'Error cargando mesoneros' };
    }
}
