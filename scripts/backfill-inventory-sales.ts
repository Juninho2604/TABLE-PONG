/**
 * SCRIPT: backfill-inventory-sales.ts
 *
 * Paso 1: Crea recetas simples (1:1) para MenuItems de bebidas/comidas empaquetadas
 *         que no tienen receta pero sí tienen un InventoryItem equivalente.
 *
 * Paso 2: Revisa TODAS las órdenes de venta y para cada ítem vendido que tenga
 *         receta, crea los movimientos de inventario faltantes y descuenta el stock.
 *
 * Es IDEMPOTENTE: se puede correr múltiples veces sin duplicar nada.
 * NO borra ningún dato.
 *
 * Uso: npm run db:backfill-sales
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// MAPEO: SKU del MenuItem → SKU del InventoryItem + unidad + cantidad
// Solo poner aquí los que tienen correspondencia directa y clara.
// Ítems de SERVICIO (Cover, Membresía) NO van aquí — no consumen inventario.
// ============================================================================
const MENU_TO_INVENTORY_MAP: Array<{
    menuSku: string;
    invSku: string;
    qty: number;
    unit: string;
    label: string;
}> = [
    // Bebidas empaquetadas directas (1 venta = 1 unidad de inventario)
    { menuSku: 'TP-CERV-POLAR',   invSku: 'BEB-POLARCITAS',      qty: 1, unit: 'UNIT', label: 'Polarcita' },
    { menuSku: 'TP-CERV-SOL-V',   invSku: 'BEB-SOLERA-VERDE',    qty: 1, unit: 'UNIT', label: 'Solera Verde' },
    { menuSku: 'TP-BEB-PEPSI',    invSku: 'BEB-PEPSI',            qty: 1, unit: 'UNIT', label: 'Pepsi' },
    { menuSku: 'TP-BEB-7UP',      invSku: 'BEB-SEVEN-UP',         qty: 1, unit: 'UNIT', label: '7UP' },
    { menuSku: 'TP-EXT-CARORE',   invSku: 'BEB-CARORENITAS',      qty: 1, unit: 'UNIT', label: 'Caroreña de Lata' },
    { menuSku: 'TP-BEB-GATOR',    invSku: 'BEB-GATORADE-ROJO',    qty: 1, unit: 'UNIT', label: 'Gatorade (→ Rojo)' },
    { menuSku: 'TP-BEB-AGUA-SP',  invSku: 'BEB-SPARKLING-ORIG',   qty: 1, unit: 'UNIT', label: 'Agua Sparkling (→ Original)' },
    { menuSku: 'TP-BEB-LIPT-D',   invSku: 'BEB-MALTA',            qty: 1, unit: 'UNIT', label: 'Lipton Durazno (→ Malta aprox)' },
    // Comidas simples
    { menuSku: 'TP-POST-MANT',    invSku: 'COM-MANTECADO',        qty: 0.1, unit: 'L', label: 'Helado Mantecado (0.1L por porción)' },
    { menuSku: 'TP-POST-CHOC',    invSku: 'COM-MANTECADO',        qty: 0.1, unit: 'L', label: 'Helado Chocolate (0.1L de base)' },
    // Nota: TP-HOTDOG-TRAD, TP-CAF-CAP-G, TP-CAF-LATTE, TP-COTUFAS-G, TP-CERV-TOBO
    // tienen múltiples ingredientes — deben configurarse manualmente desde la UI de Recetas.
    // TP-BEB-AGUA-P, TP-BEB-AGUA-G → no existen en inventario, ignorados.
];

// ============================================================================
// PASO 1: Crear recetas 1:1 para ítems sin receta
// ============================================================================
async function step1CreateSimpleRecipes() {
    console.log('\n--- PASO 1: Creando recetas simples para menú items sin receta ---\n');

    // Obtener el primer usuario admin disponible como creador
    const adminUser = await prisma.user.findFirst({
        where: { role: { in: ['OWNER', 'ADMIN_MANAGER'] }, isActive: true }
    });

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const mapping of MENU_TO_INVENTORY_MAP) {
        try {
            // Buscar el MenuItem
            const menuItem = await prisma.menuItem.findFirst({
                where: { sku: mapping.menuSku }
            });
            if (!menuItem) {
                console.log(`  ⏭️  [${mapping.menuSku}] MenuItem no encontrado — omitiendo`);
                skipped++;
                continue;
            }

            // Si ya tiene receta, no tocar
            if (menuItem.recipeId) {
                console.log(`  ✅  [${mapping.menuSku}] ${menuItem.name} ya tiene receta — sin cambios`);
                skipped++;
                continue;
            }

            // Buscar el InventoryItem
            const invItem = await prisma.inventoryItem.findFirst({
                where: { sku: mapping.invSku }
            });
            if (!invItem) {
                console.log(`  ❌  [${mapping.menuSku}] InventoryItem SKU "${mapping.invSku}" no encontrado — omitiendo`);
                errors++;
                continue;
            }

            // Crear receta + ingrediente + vincular al menuItem (en transacción)
            await prisma.$transaction(async (tx) => {
                const recipe = await tx.recipe.create({
                    data: {
                        name: `Receta: ${menuItem.name}`,
                        recipeType: 'STANDARD',
                        outputItemId: invItem.id,
                        outputQuantity: mapping.qty,
                        outputUnit: mapping.unit,
                        isApproved: true,
                        isActive: true,
                        createdById: adminUser?.id ?? null,
                        ingredients: {
                            create: [{
                                ingredientItemId: invItem.id,
                                quantity: mapping.qty,
                                unit: mapping.unit,
                                sortOrder: 1,
                                notes: 'Receta automática — 1:1 con inventario'
                            }]
                        }
                    }
                });

                await tx.menuItem.update({
                    where: { id: menuItem.id },
                    data: { recipeId: recipe.id }
                });
            });

            console.log(`  ✅  [${mapping.menuSku}] ${menuItem.name} → "${invItem.name}" (${mapping.qty} ${mapping.unit}) — receta creada`);
            created++;

        } catch (err: any) {
            console.error(`  ❌  [${mapping.menuSku}] Error: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n  Creadas: ${created} | Ya existían: ${skipped} | Errores: ${errors}`);
}

// ============================================================================
// PASO 2: Backfill de movimientos de inventario para órdenes históricas
// ============================================================================
async function step2BackfillInventoryMovements() {
    console.log('\n--- PASO 2: Descontando inventario de ventas históricas ---\n');

    const orders = await prisma.salesOrder.findMany({
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
        include: {
            items: {
                include: {
                    menuItem: {
                        include: {
                            recipe: {
                                include: {
                                    ingredients: {
                                        include: { ingredientItem: true }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            area: true,
            createdBy: { select: { id: true } }
        }
    });

    console.log(`📦 Órdenes a procesar: ${orders.length}`);

    // Movimientos SALE ya existentes (para no duplicar)
    const existingMovements = await prisma.inventoryMovement.findMany({
        where: { movementType: 'SALE', salesOrderId: { not: null } },
        select: { salesOrderId: true, inventoryItemId: true, quantity: true }
    });
    const existingMap = new Map<string, number>();
    for (const m of existingMovements) {
        const key = `${m.salesOrderId}|${m.inventoryItemId}`;
        existingMap.set(key, (existingMap.get(key) || 0) + m.quantity);
    }

    let created = 0;
    let alreadyExisted = 0;
    let noRecipe = 0;
    let errors = 0;

    for (const order of orders) {
        for (const orderItem of order.items) {
            const menuItem = orderItem.menuItem;

            if (!menuItem?.recipe || !menuItem.recipe.isActive) {
                noRecipe++;
                continue;
            }

            for (const ingredient of menuItem.recipe.ingredients) {
                const totalQty = ingredient.quantity * orderItem.quantity;
                const key = `${order.id}|${ingredient.ingredientItemId}`;
                const alreadyRegistered = existingMap.get(key) || 0;

                if (alreadyRegistered >= totalQty) {
                    alreadyExisted++;
                    continue;
                }

                const qtyToRegister = totalQty - alreadyRegistered;

                try {
                    const costHistory = await prisma.costHistory.findFirst({
                        where: { inventoryItemId: ingredient.ingredientItemId, effectiveTo: null },
                        orderBy: { effectiveFrom: 'desc' }
                    });
                    const unitCost = costHistory ? Number(costHistory.costPerUnit) : 0;

                    await prisma.$transaction(async (tx) => {
                        await tx.inventoryMovement.create({
                            data: {
                                inventoryItemId: ingredient.ingredientItemId,
                                movementType: 'SALE',
                                quantity: qtyToRegister,
                                unit: ingredient.unit,
                                unitCost,
                                totalCost: qtyToRegister * unitCost,
                                notes: `[BACKFILL] ${orderItem.quantity}x ${menuItem.name}`,
                                reason: `Venta - Orden: ${order.id}`,
                                salesOrderId: order.id,
                                createdById: order.createdBy?.id || order.createdById,
                                createdAt: order.createdAt,
                            }
                        });

                        await tx.inventoryLocation.upsert({
                            where: {
                                inventoryItemId_areaId: {
                                    inventoryItemId: ingredient.ingredientItemId,
                                    areaId: order.areaId,
                                }
                            },
                            update: { currentStock: { decrement: qtyToRegister } },
                            create: {
                                inventoryItemId: ingredient.ingredientItemId,
                                areaId: order.areaId,
                                currentStock: -qtyToRegister,
                            }
                        });
                    });

                    console.log(`  ✅  [${order.orderNumber}] ${orderItem.itemName} → -${qtyToRegister} ${ingredient.unit} de "${ingredient.ingredientItem?.name}" en (${order.area?.name})`);
                    created++;

                } catch (err: any) {
                    console.error(`  ❌  [${order.orderNumber}] ${ingredient.ingredientItem?.name}: ${err.message}`);
                    errors++;
                }
            }
        }
    }

    console.log(`\n  Movimientos creados: ${created}`);
    console.log(`  Ya existían (sin duplicar): ${alreadyExisted}`);
    console.log(`  Sin receta (no trackeable): ${noRecipe}`);
    console.log(`  Errores: ${errors}`);
    return { created, noRecipe, errors };
}

// ============================================================================
// PASO 3: Reporte final de stock
// ============================================================================
async function step3StockReport() {
    console.log('\n--- STOCK ACTUAL (ítems con movimiento) ---\n');

    const locations = await prisma.inventoryLocation.findMany({
        where: { currentStock: { not: 0 } },
        include: {
            inventoryItem: { select: { name: true, baseUnit: true, sku: true } },
            area: { select: { name: true } }
        },
        orderBy: { area: { name: 'asc' } }
    });

    let lastArea = '';
    for (const loc of locations) {
        if (loc.area.name !== lastArea) {
            console.log(`\n  📦 ${loc.area.name}`);
            lastArea = loc.area.name;
        }
        const stock = Number(loc.currentStock);
        const warn = stock < 0 ? ' ⚠️  NEGATIVO' : '';
        console.log(`     [${loc.inventoryItem.sku}] ${loc.inventoryItem.name}: ${stock.toFixed(2)} ${loc.inventoryItem.baseUnit}${warn}`);
    }

    const negatives = locations.filter(l => Number(l.currentStock) < 0);
    if (negatives.length > 0) {
        console.log(`\n  ⚠️  ${negatives.length} ítems con stock negativo (vendidos más de lo registrado en inventario)`);
    }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log('\n====================================================');
    console.log('  BACKFILL COMPLETO: Recetas + Inventario histórico');
    console.log('====================================================');

    await step1CreateSimpleRecipes();
    const result = await step2BackfillInventoryMovements();
    await step3StockReport();

    console.log('\n====================================================');
    console.log('  RESUMEN FINAL');
    console.log('====================================================');
    console.log(`  ✅ Movimientos de inventario creados: ${result.created}`);
    console.log(`  📋 Ítems sin receta (sin trackeo posible): ${result.noRecipe}`);
    if (result.noRecipe > 0) {
        console.log('     → Para trackearlos, crear sus recetas desde la UI de Recetas.');
        console.log('     → Ítems pendientes: Hot Dog, Cappuccino, Latte, Cotufas, Tobo de Cervezas,');
        console.log('       Agua Pequeña, Agua Grande, Lipton (si cambia mapping).');
    }
    console.log('\n✨ Completado.\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
