/**
 * Carga inventario real por almacén - Table Pong
 * Ejecutar: npm run db:seed-inventario-real
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Áreas a usar (crear si no existen)
// PLASTICOS es categoría dentro de ALMACEN PRINCIPAL, no un almacén
const AREAS = [
    { id: 'area-barra-principal', name: 'BARRA PRINCIPAL', description: 'Barra principal' },
    { id: 'area-deposito-barra', name: 'DEPOSITO BARRA', description: 'Depósito de barra' },
    { id: 'area-almacen-principal', name: 'ALMACEN PRINCIPAL', description: 'Almacén principal (Comida + Plásticos)' },
];

type StockEntry = { areaId: string; qty: number };
type InventoryEntry = {
    sku: string; name: string; category: string; baseUnit: string;
    isBeverage?: boolean;
    stocks: StockEntry[];
};

const INVENTORY: InventoryEntry[] = [
    // ========== LICORES - BARRA PRINCIPAL ==========
    { sku: 'LIC-FINCA-MORAS', name: 'Finca Las Moras', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 5 }] },
    { sku: 'LIC-JAGERMEISTER', name: 'Jagermeister', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 3 }] },
    { sku: 'LIC-FINCA-MORAS-B', name: 'Finca Las Moras Blanco', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-SANTA-TERESA-GR', name: 'Santa Teresa Gran Reserva', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 5 }] },
    { sku: 'LIC-GORDONS-VODKA', name: 'Gordons Vodka', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 6 }] },
    { sku: 'LIC-CACIQUE', name: 'Cacique', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-BUCHANAS-12', name: 'Buchanas 12 años', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 3 }] },
    { sku: 'LIC-CARUPANO-18', name: 'Carupano 18', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-DIPLOMATICO', name: 'Diplomático', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-TANQUEREI', name: 'Ginebra Tanguerei', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-BOMBAY-GIN', name: 'Bombay Gin', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 2 }] },
    { sku: 'LIC-JOSE-CUERVO-SIL', name: 'Jose Cuervo Silveria Litro', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 2 }] },
    { sku: 'LIC-VERMOUTH-ROSSO', name: 'Vermouth Rosso', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-VERMOUTH-EXTRA', name: 'Vermouth Extra Dry', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 3 }] },
    { sku: 'LIC-APEROL', name: 'Aperol', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-JARABE-GOMA', name: 'Jarabes de Goma', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 2 }] },
    { sku: 'LIC-BLUE-CURACAO', name: 'Blue Curaçao', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-GRANADINA', name: 'Granadina', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-STOLICHNAYA', name: 'Stolichnaya', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }] },
    { sku: 'LIC-AMARETTO', name: 'Amaretto', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 2 }] },
    // ========== BEBIDAS - BARRA + DEPOSITO ==========
    { sku: 'BEB-PEPSI', name: 'Pepsi', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 76 }, { areaId: 'area-deposito-barra', qty: 168 }] },
    { sku: 'BEB-SPARKLING-ORIG', name: 'Sparkling Original', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 10 }, { areaId: 'area-deposito-barra', qty: 12 }] },
    { sku: 'BEB-SPARKLING-LIMON', name: 'Sparkling Limón', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 3 }] },
    { sku: 'BEB-SPARKLING-TORONJA', name: 'Sparkling Toronja', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 5 }] },
    { sku: 'BEB-PEPSI-LIGHT', name: 'Pepsi Light', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 26 }] },
    { sku: 'BEB-SEVEN-UP', name: 'Seven Up', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 7 }] },
    { sku: 'BEB-MALTA', name: 'Malta', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 10 }, { areaId: 'area-deposito-barra', qty: 24 }] },
    { sku: 'BEB-GATORADE-AMARILLO', name: 'Gatorade Amarillo', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 9 }, { areaId: 'area-deposito-barra', qty: 24 }] },
    { sku: 'BEB-GATORADE-AZUL', name: 'Gatorade Azul', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 14 }, { areaId: 'area-deposito-barra', qty: 36 }] },
    { sku: 'BEB-GATORADE-ROJO', name: 'Gatorade Rojo', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 1 }, { areaId: 'area-deposito-barra', qty: 48 }] },
    { sku: 'BEB-CARORENITAS', name: 'Caroreñitas', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 30 }] },
    { sku: 'BEB-POLARCITAS', name: 'Polarcitas', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 35 }, { areaId: 'area-deposito-barra', qty: 216 }] },
    { sku: 'BEB-SOLERA-VERDE', name: 'Solera Verde', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-barra-principal', qty: 56 }] },
    { sku: 'BEB-SODA', name: 'Soda', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-deposito-barra', qty: 96 }] },
    { sku: 'BEB-AGUAKINA', name: 'Aguakina', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true, stocks: [{ areaId: 'area-deposito-barra', qty: 48 }] },
    // ========== ALMACEN PRINCIPAL - COMIDA ==========
    { sku: 'COM-PAPAS-PERRO', name: 'Papas para Perro', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 1 }] },
    { sku: 'COM-ACEITE-L', name: 'Aceite Litro', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 5 }] },
    { sku: 'COM-MANTEQUILLA', name: 'Mantequilla', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 2 }] },
    { sku: 'COM-SALSA-TOMATE', name: 'Salsa de Tomate', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 0.5 }] },
    { sku: 'COM-MAYONESA', name: 'Mayonesa', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 1 }] },
    { sku: 'COM-PAN-PERRO', name: 'Pan para Perro', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 4 }] },
    { sku: 'COM-MAIZ', name: 'Maíz', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 7 }] },
    { sku: 'COM-MOSTAZA', name: 'Mostaza', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 3 }] },
    { sku: 'COM-LECHE-DESCREMADA', name: 'Leche Descremada', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 2 }] },
    { sku: 'COM-LECHE-ALMENDRAS', name: 'Leche de Almendras', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 1 }] },
    { sku: 'COM-CACAO-PURO', name: 'Cacao Puro', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 1 }] },
    { sku: 'COM-REMOVEDORES', name: 'Removedores', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 2000 }] },
    { sku: 'COM-AZUCAR', name: 'Azúcar', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 10 }] },
    { sku: 'COM-VAINILLA', name: 'Vainilla', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 0.5 }] },
    { sku: 'COM-AZUCAR-MORENA', name: 'Azúcar Morena', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 1 }] },
    { sku: 'COM-CREMA-COCO', name: 'Crema de Coco', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 2 }] },
    { sku: 'COM-LECHE-CONDENSADA', name: 'Leche Condensada', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 6 }] },
    { sku: 'COM-QUESO-CACHAPA', name: 'Queso para Cachapa', category: 'COMIDA', baseUnit: 'KG', stocks: [{ areaId: 'area-almacen-principal', qty: 2 }] },
    { sku: 'COM-SALCHICHA', name: 'Salchicha', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 7 }] },
    { sku: 'COM-LUCKY-STRIKE', name: 'Lucky Strike', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 13 }] },
    { sku: 'COM-TE-NEGRO', name: 'Té Negro', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 9 }] },
    { sku: 'COM-CARBONES', name: 'Carbones', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 29 }] },
    { sku: 'COM-ESCENCIAS-VARIAS', name: 'Esencias Varias', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 9 }] },
    { sku: 'COM-BOQUILLAS-NARGUILE', name: 'Boquillas Narguile', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 15 }] },
    { sku: 'COM-NARGUILE', name: 'Narguile', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 2 }] },
    { sku: 'COM-GALLETAS-HELADO', name: 'Galletas Dulce de Helado', category: 'COMIDA', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 400 }] },
    { sku: 'COM-MANTECADO', name: 'Mantecado', category: 'COMIDA', baseUnit: 'L', stocks: [{ areaId: 'area-almacen-principal', qty: 8 }] },
    // ========== PLASTICOS (categoría en ALMACEN PRINCIPAL) ==========
    { sku: 'PLA-ENVASE-500ML', name: 'Envases para Llevar 500ml', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 39 }] },
    { sku: 'PLA-PITILLOS-GRUESOS', name: 'Pitillos Gruesos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 1200 }] },
    { sku: 'PLA-MONDADIENTES', name: 'Mondadientes', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 40 }] },
    { sku: 'PLA-PORTA-VASOS', name: 'Porta Vasos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 3750 }] },
    { sku: 'PLA-INDIVIDUALES', name: 'Individuales', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 4000 }] },
    { sku: 'PLA-BOLSAS-LLEVAR', name: 'Bolsas para Llevar', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 550 }] },
    { sku: 'PLA-PITILLOS-FINOS', name: 'Pitillos Finos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 700 }] },
    { sku: 'PLA-BOLSAS-COTUFAS', name: 'Bolsas de Cotufas', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 350 }] },
    { sku: 'PLA-TAPAS-VASOS-CAFE', name: 'Tapas para Vasos de Café', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 100 }] },
    { sku: 'PLA-VASOS-CAFE', name: 'Vasos para Café', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 100 }] },
    { sku: 'PLA-SERVILLETAS', name: 'Servilletas', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 12 }] },
    { sku: 'PLA-VASOS', name: 'Vasos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 170 }] },
    { sku: 'PLA-PLATOS', name: 'Platos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 180 }] },
    { sku: 'PLA-TENEDORES', name: 'Tenedores Plásticos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 100 }] },
    { sku: 'PLA-CUCHARILLAS', name: 'Cucharillas Pequeñas Plásticas', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 150 }] },
    { sku: 'PLA-CUCHILLOS', name: 'Cuchillos Plásticos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 138 }] },
    { sku: 'PLA-VASOS-ROJOS', name: 'Vasos Rojos', category: 'PLASTICOS', baseUnit: 'UNIT', stocks: [{ areaId: 'area-almacen-principal', qty: 175 }] },
];

async function main() {
    console.log('🌱 Cargando inventario real por almacén...\n');

    // Eliminar área PLASTICOS si existe (ahora es categoría en ALMACEN PRINCIPAL)
    const oldPlasticos = await prisma.area.findUnique({ where: { id: 'area-plasticos' } });
    if (oldPlasticos) {
        await prisma.inventoryLocation.deleteMany({ where: { areaId: 'area-plasticos' } });
        await prisma.area.delete({ where: { id: 'area-plasticos' } });
        console.log('🗑️ Área PLASTICOS eliminada (ahora categoría en Almacén Principal)\n');
    }

    for (const a of AREAS) {
        await prisma.area.upsert({
            where: { id: a.id },
            update: { name: a.name, description: a.description },
            create: a,
        });
        console.log(`📍 Área: ${a.name}`);
    }

    let created = 0;
    for (const item of INVENTORY) {
        const { stocks, ...itemData } = item;
        const existing = await prisma.inventoryItem.findUnique({ where: { sku: itemData.sku } });

        let invItem;
        if (existing) {
            invItem = existing;
        } else {
            invItem = await prisma.inventoryItem.create({
                data: {
                    sku: itemData.sku,
                    name: itemData.name,
                    type: 'RAW_MATERIAL',
                    category: itemData.category,
                    baseUnit: itemData.baseUnit,
                    isBeverage: itemData.isBeverage ?? false,
                },
            });
            created++;
        }

        for (const s of stocks) {
            await prisma.inventoryLocation.upsert({
                where: {
                    inventoryItemId_areaId: {
                        inventoryItemId: invItem.id,
                        areaId: s.areaId,
                    },
                },
                create: {
                    inventoryItemId: invItem.id,
                    areaId: s.areaId,
                    currentStock: s.qty,
                },
                update: { currentStock: s.qty },
            });
        }

        const areaNames = stocks.map(s => AREAS.find(a => a.id === s.areaId)?.name).join(', ');
        console.log(`✅ ${itemData.sku} - ${itemData.name} [${itemData.category}] → ${areaNames}`);
    }

    console.log(`\n📊 ${created} items nuevos, ${INVENTORY.length} total procesados`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
