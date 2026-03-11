/**
 * SCRIPT: setup-missing-recipes.ts
 *
 * Crea los ítems de inventario y recetas faltantes para:
 *   - Hot Dog Tradicional (Pan + Salchicha + Papas)
 *   - Cappuccino Grande (1:1 tracking)
 *   - Latte (1:1 tracking)
 *   - Agua Pequeña 355ml (nuevo ítem inventario)
 *   - Agua Grande 600ml (nuevo ítem inventario)
 *   - Tobo de Cervezas (5 Polarcitas + 5 Solera Verde)
 *   - Cover → Brazalete Cover (nuevo ítem inventario)
 *
 * Uso: npx tsx scripts/setup-missing-recipes.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_ID = 'cmmh6uen80000qqiqapho9kia'; // Hender - ADMIN_MANAGER

// IDs de inventario ya existentes
const INV = {
    PAN_PERRO:    'cmmjix7xc003qbq4cx0kx2x71',
    SALCHICHA:    'cmmjix9xf004tbq4ctf5fme9a',
    PAPAS_PERRO:  'cmmjix75f003bbq4cqr9cuaqw',
    POLARCITAS:   'cmmjix6hf002xbq4cyy79axt9',
    SOLERA_VERDE: 'cmmjix6ov0032bq4cmqrgbay0',
};

// IDs de MenuItem
const MENU = {
    HOTDOG:      'cmmgtjmdh0006ocr84broc5vt',
    CAPPUCCINO:  'cmmgtjnwh001oocr88i4bzd7m',
    LATTE:       'cmmgtjny6001qocr8jr6oxmat',
    AGUA_P:      'cmmgtjnpj001iocr8xmgos24m',
    AGUA_G:      'cmmgtjnra001kocr8n91q84s5',
    COVER:       'cmmgtjs1e005socr8w4a47vnm',
    TOBO:        'cmmgtjn8e0010ocr8iiy0flkk',
};

async function createInvItemIfNotExists(data: {
    sku: string;
    name: string;
    baseUnit: string;
    type?: string;
    category?: string;
}) {
    const existing = await prisma.inventoryItem.findFirst({ where: { sku: data.sku } });
    if (existing) {
        console.log(`  ⏭️  Inventario "${data.name}" ya existe (${existing.id})`);
        return existing;
    }
    const item = await prisma.inventoryItem.create({
        data: {
            sku: data.sku,
            name: data.name,
            baseUnit: data.baseUnit,
            type: data.type ?? 'FINISHED_GOOD',
            category: data.category ?? 'BEBIDAS',
            stockTrackingMode: 'UNIT',
            minimumStock: 0,
            reorderPoint: 0,
        }
    });
    console.log(`  ✅  Inventario creado: "${item.name}" [${item.sku}] (${item.id})`);
    return item;
}

async function createRecipeAndLink(params: {
    menuItemId: string;
    menuItemName: string;
    recipeName: string;
    outputItemId: string;
    outputQty: number;
    outputUnit: string;
    ingredients: { itemId: string; qty: number; unit: string; name: string }[];
}) {
    // Verificar si ya tiene receta
    const menuItem = await prisma.menuItem.findUnique({
        where: { id: params.menuItemId },
        select: { recipeId: true, name: true }
    });
    if (menuItem?.recipeId) {
        console.log(`  ⏭️  "${params.menuItemName}" ya tiene receta — sin cambios`);
        return;
    }

    await prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.create({
            data: {
                name: params.recipeName,
                recipeType: 'STANDARD',
                outputItemId: params.outputItemId,
                outputQuantity: params.outputQty,
                outputUnit: params.outputUnit,
                isApproved: true,
                isActive: true,
                createdById: ADMIN_ID,
                ingredients: {
                    create: params.ingredients.map((ing, i) => ({
                        ingredientItemId: ing.itemId,
                        quantity: ing.qty,
                        unit: ing.unit,
                        sortOrder: i + 1,
                    }))
                }
            }
        });

        await tx.menuItem.update({
            where: { id: params.menuItemId },
            data: { recipeId: recipe.id }
        });
    });

    const ingList = params.ingredients.map(i => `${i.qty} ${i.unit} ${i.name}`).join(', ');
    console.log(`  ✅  Receta creada: "${params.menuItemName}" ← [${ingList}]`);
}

async function main() {
    console.log('\n====================================================');
    console.log('  SETUP: Recetas e ítems de inventario faltantes');
    console.log('====================================================\n');

    // ================================================================
    // 1. HOT DOG TRADICIONAL
    // ================================================================
    console.log('\n📌 Hot Dog Tradicional');
    await createRecipeAndLink({
        menuItemId: MENU.HOTDOG,
        menuItemName: 'Hot Dog Tradicional',
        recipeName: 'Receta: Hot Dog Tradicional',
        outputItemId: INV.PAN_PERRO,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: INV.PAN_PERRO,   qty: 1,    unit: 'UNIT', name: 'Pan para Perro' },
            { itemId: INV.SALCHICHA,   qty: 1,    unit: 'UNIT', name: 'Salchicha' },
            { itemId: INV.PAPAS_PERRO, qty: 0.01, unit: 'KG',   name: 'Papas para Perro (10g)' },
        ]
    });

    // ================================================================
    // 2. CAPPUCCINO GRANDE (1:1 tracking)
    // ================================================================
    console.log('\n📌 Cappuccino Grande');
    const invCappuccino = await createInvItemIfNotExists({
        sku: 'CAF-CAPPUCCINO-G',
        name: 'Cappuccino Grande (porción)',
        baseUnit: 'UNIT',
        type: 'FINISHED_GOOD',
        category: 'CAFETERÍA',
    });
    await createRecipeAndLink({
        menuItemId: MENU.CAPPUCCINO,
        menuItemName: 'Cappuccino Grande',
        recipeName: 'Receta: Cappuccino Grande',
        outputItemId: invCappuccino.id,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: invCappuccino.id, qty: 1, unit: 'UNIT', name: 'Cappuccino Grande (porción)' },
        ]
    });

    // ================================================================
    // 3. LATTE (1:1 tracking)
    // ================================================================
    console.log('\n📌 Latte');
    const invLatte = await createInvItemIfNotExists({
        sku: 'CAF-LATTE',
        name: 'Latte (porción)',
        baseUnit: 'UNIT',
        type: 'FINISHED_GOOD',
        category: 'CAFETERÍA',
    });
    await createRecipeAndLink({
        menuItemId: MENU.LATTE,
        menuItemName: 'Latte',
        recipeName: 'Receta: Latte',
        outputItemId: invLatte.id,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: invLatte.id, qty: 1, unit: 'UNIT', name: 'Latte (porción)' },
        ]
    });

    // ================================================================
    // 4. AGUA PEQUEÑA 355ml
    // ================================================================
    console.log('\n📌 Agua Pequeña 355ml');
    const invAguaP = await createInvItemIfNotExists({
        sku: 'BEB-AGUA-PEQUENA-355',
        name: 'Agua Pequeña 355ml',
        baseUnit: 'UNIT',
        type: 'RAW_MATERIAL',
        category: 'BEBIDAS',
    });
    await createRecipeAndLink({
        menuItemId: MENU.AGUA_P,
        menuItemName: 'Agua Pequeña',
        recipeName: 'Receta: Agua Pequeña',
        outputItemId: invAguaP.id,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: invAguaP.id, qty: 1, unit: 'UNIT', name: 'Agua Pequeña 355ml' },
        ]
    });

    // ================================================================
    // 5. AGUA GRANDE 600ml
    // ================================================================
    console.log('\n📌 Agua Grande 600ml');
    const invAguaG = await createInvItemIfNotExists({
        sku: 'BEB-AGUA-GRANDE-600',
        name: 'Agua Grande 600ml',
        baseUnit: 'UNIT',
        type: 'RAW_MATERIAL',
        category: 'BEBIDAS',
    });
    await createRecipeAndLink({
        menuItemId: MENU.AGUA_G,
        menuItemName: 'Agua Grande',
        recipeName: 'Receta: Agua Grande',
        outputItemId: invAguaG.id,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: invAguaG.id, qty: 1, unit: 'UNIT', name: 'Agua Grande 600ml' },
        ]
    });

    // ================================================================
    // 6. BRAZALETE COVER (Cover Dom-Jue)
    // ================================================================
    console.log('\n📌 Brazalete Cover');
    const invCover = await createInvItemIfNotExists({
        sku: 'OPE-BRAZALETE-COVER',
        name: 'Brazalete Cover',
        baseUnit: 'UNIT',
        type: 'FINISHED_GOOD',
        category: 'OPERACIONES',
    });
    await createRecipeAndLink({
        menuItemId: MENU.COVER,
        menuItemName: 'Cover Dom-Jue',
        recipeName: 'Receta: Brazalete Cover',
        outputItemId: invCover.id,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: invCover.id, qty: 1, unit: 'UNIT', name: 'Brazalete Cover' },
        ]
    });

    // ================================================================
    // 7. TOBO DE CERVEZAS (5 Polarcitas + 5 Solera Verde = 10 cervezas)
    // ================================================================
    console.log('\n📌 Tobo de Cervezas (Polar/Solera)');
    // El tobo necesita un outputItemId - usamos Polarcitas como salida principal
    await createRecipeAndLink({
        menuItemId: MENU.TOBO,
        menuItemName: 'Tobo de Cervezas (Polar/Solera)',
        recipeName: 'Receta: Tobo de Cervezas',
        outputItemId: INV.POLARCITAS,
        outputQty: 1,
        outputUnit: 'UNIT',
        ingredients: [
            { itemId: INV.POLARCITAS,   qty: 5, unit: 'UNIT', name: 'Polarcitas' },
            { itemId: INV.SOLERA_VERDE, qty: 5, unit: 'UNIT', name: 'Solera Verde' },
        ]
    });

    // ================================================================
    // RESUMEN FINAL
    // ================================================================
    console.log('\n====================================================');
    console.log('  SETUP COMPLETADO');
    console.log('====================================================');
    console.log('  Ahora corre: npm run db:backfill-sales');
    console.log('  para registrar el descuento histórico de los nuevos items.\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
