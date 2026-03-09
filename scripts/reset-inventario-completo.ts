/**
 * BORRA TODOS LOS SKU E INVENTARIO
 * Permite volver a cargar desde cero.
 * Ejecutar: npm run db:reset-inventario
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function main() {
    console.log('\n⚠️  ADVERTENCIA - BORRADO TOTAL DE INVENTARIO ⚠️');
    console.log('Este script ELIMINARÁ TODOS los SKU e items de inventario.');
    console.log('Se mantendrán: Usuarios, Áreas, Menú (productos de venta), Proveedores.');
    console.log('Se eliminarán: Items de inventario, Recetas, Movimientos, etc.\n');

    rl.question('Escribe "BORRAR INVENTARIO" para confirmar: ', async (answer) => {
        if (answer !== 'BORRAR INVENTARIO') {
            console.log('Operación cancelada.');
            process.exit(0);
        }

        try {
            console.log('\nIniciando borrado...');

            await prisma.$transaction(async (tx) => {
                console.log('Eliminando items críticos por área...');
                await tx.areaCriticalItem.deleteMany({});

                console.log('Eliminando movimientos de inventario...');
                await tx.inventoryMovement.deleteMany({});

                console.log('Eliminando historial de costos...');
                await tx.costHistory.deleteMany({});

                console.log('Eliminando items de requisiciones...');
                await tx.requisitionItem.deleteMany({});

                console.log('Eliminando inventarios diarios...');
                await tx.dailyInventoryItem.deleteMany({});
                await tx.dailyInventory.deleteMany({});

                console.log('Eliminando auditorías de inventario...');
                await tx.inventoryAuditItem.deleteMany({});
                await tx.inventoryAudit.deleteMany({});

                console.log('Eliminando préstamos...');
                await tx.inventoryLoan.deleteMany({});

                console.log('Eliminando items de proveedores...');
                await tx.supplierItem.deleteMany({});

                console.log('Eliminando items de órdenes de compra...');
                await tx.purchaseOrderItem.deleteMany({});

                console.log('Eliminando subproductos de proteínas...');
                await tx.proteinSubProduct.deleteMany({});
                console.log('Eliminando procesamiento de proteínas...');
                await tx.proteinProcessing.deleteMany({});

                console.log('Eliminando plantillas de procesamiento...');
                await tx.processingTemplateOutput.deleteMany({});
                await tx.processingTemplate.deleteMany({});

                console.log('Eliminando ingredientes de recetas...');
                await tx.recipeIngredient.deleteMany({});
                console.log('Eliminando órdenes de producción...');
                await tx.productionOrder.deleteMany({});
                console.log('Desvinculando menú de recetas...');
                await tx.menuItem.updateMany({ data: { recipeId: null } });
                console.log('Eliminando recetas...');
                await tx.recipe.deleteMany({});

                console.log('Eliminando ubicaciones de stock...');
                await tx.inventoryLocation.deleteMany({});

                console.log('Eliminando items de inventario...');
                await tx.inventoryItem.deleteMany({});

                console.log('✅ Inventario borrado completamente.');
            });
        } catch (error) {
            console.error('Error:', error);
        } finally {
            await prisma.$disconnect();
            process.exit(0);
        }
    });
}

main();
