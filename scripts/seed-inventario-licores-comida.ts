/**
 * Script para cargar SKUs de inventario (sin cantidades)
 * Basado en inventario real de Table Pong - Ely TP 8/3/2026
 * Ejecutar: npx tsx scripts/seed-inventario-licores-comida.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ItemInput {
    sku: string;
    name: string;
    category: string;
    baseUnit: string;
    type?: string;
    isBeverage?: boolean;
}

const ITEMS: ItemInput[] = [
    // ========== LICORES (Reserva del Bar) ==========
    { sku: 'LIC-FINCA-MORAS', name: 'Finca Las Moras', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-JAGERMEISTER', name: 'Jagermeister', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-FINCA-MORAS-B', name: 'Finca Las Moras Blanco', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-SANTA-TERESA-GR', name: 'Santa Teresa Gran Reserva', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-GORDONS-VODKA', name: 'Gordons Vodka', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-CACIQUE', name: 'Cacique', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-BUCHANAS-12', name: 'Buchanas 12 años', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-CARUPANO-18', name: 'Carupano 18', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-DIPLOMATICO', name: 'Diplomático', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-TANQUEREI', name: 'Ginebra Tanguerei', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-BOMBAY-GIN', name: 'Bombay Gin', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-JOSE-CUERVO-SIL', name: 'Jose Cuervo Silveria Litro', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-VERMOUTH-ROSSO', name: 'Vermouth Rosso', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-VERMOUTH-EXTRA', name: 'Vermouth Extra Dry', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-APEROL', name: 'Aperol', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-JARABE-GOMA', name: 'Jarabes de Goma', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-BLUE-CURACAO', name: 'Blue Curaçao', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-GRANADINA', name: 'Granadina', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-STOLICHNAYA', name: 'Stolichnaya', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'LIC-AMARETTO', name: 'Amaretto', category: 'LICORES', baseUnit: 'UNIT', isBeverage: true },
    // ========== PEPSI DEPOSITÓ ==========
    { sku: 'BEB-PEPSI', name: 'Pepsi', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-GATORADE-ROJO', name: 'Gatorade Rojo', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-GATORADE-AZUL', name: 'Gatorade Azul', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-GATORADE-AMARILLO', name: 'Gatorade Amarillo', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-SODA', name: 'Soda', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-AGUAKINA', name: 'Aguakina', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-SPARKLING-ORIG', name: 'Sparkling Original', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-MALTA', name: 'Malta', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    // ========== POLAR DEPOSITÓ ==========
    { sku: 'BEB-POLAR', name: 'Polar', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    // ========== NEVERA PEPSI ==========
    { sku: 'BEB-PEPSI-LIGHT', name: 'Pepsi Light', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-SPARKLING-LIMON', name: 'Sparkling Limón', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-SPARKLING-TORONJA', name: 'Sparkling Toronja', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-SEVEN-UP', name: 'Seven Up', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-CARORENITAS', name: 'Caroreñitas', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    // ========== NEVERA POLAR ==========
    { sku: 'BEB-POLARCITAS', name: 'Polarcitas', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    { sku: 'BEB-SOLERA-VERDE', name: 'Solera Verde', category: 'BEBIDAS', baseUnit: 'UNIT', isBeverage: true },
    // ========== COMIDA TP ==========
    { sku: 'COM-PAPAS-PERRO', name: 'Papas para Perro', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-ACEITE-L', name: 'Aceite Litro', category: 'COMIDA', baseUnit: 'L' },
    { sku: 'COM-MANTEQUILLA', name: 'Mantequilla', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-SALSA-TOMATE', name: 'Salsa de Tomate', category: 'COMIDA', baseUnit: 'ML' },
    { sku: 'COM-MAYONESA', name: 'Mayonesa', category: 'COMIDA', baseUnit: 'L' },
    { sku: 'COM-PAN-PERRO', name: 'Pan para Perro', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-MAIZ', name: 'Maíz', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-MOSTAZA', name: 'Mostaza', category: 'COMIDA', baseUnit: 'L' },
    { sku: 'COM-LECHE-DESCREMADA', name: 'Leche Descremada', category: 'COMIDA', baseUnit: 'L' },
    { sku: 'COM-LECHE-ALMENDRAS', name: 'Leche de Almendras', category: 'COMIDA', baseUnit: 'L' },
    { sku: 'COM-CACAO-PURO', name: 'Cacao Puro', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-REMOVEDORES', name: 'Removedores', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-AZUCAR', name: 'Azúcar', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-VAINILLA', name: 'Vainilla', category: 'COMIDA', baseUnit: 'ML' },
    { sku: 'COM-AZUCAR-MORENA', name: 'Azúcar Morena', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-CREMA-COCO', name: 'Crema de Coco', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-LECHE-CONDENSADA', name: 'Leche Condensada', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-QUESO-CACHAPA', name: 'Queso para Cachapa', category: 'COMIDA', baseUnit: 'KG' },
    { sku: 'COM-SALCHICHA', name: 'Salchicha', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-LUCKY-STRIKE', name: 'Lucky Strike', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-TE-NEGRO', name: 'Té Negro', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-CARBONES', name: 'Carbones', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-ESCENCIAS-VARIAS', name: 'Esencias Varias', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-BOQUILLAS-NARGUILE', name: 'Boquillas Narguile', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-NARGUILE', name: 'Narguile', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-GALLETAS-HELADO', name: 'Galletas Dulce de Helado', category: 'COMIDA', baseUnit: 'UNIT' },
    { sku: 'COM-MANTECADO', name: 'Mantecado', category: 'COMIDA', baseUnit: 'L' },
    { sku: 'COM-CHOCOLATE', name: 'Chocolate', category: 'COMIDA', baseUnit: 'KG' },
    // ========== PLÁSTICOS ==========
    { sku: 'PLA-ENVASE-500ML', name: 'Envases para Llaver 500ml', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-PITILLOS-GRUESOS', name: 'Pitillos Gruesos', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-MONDADIENTES', name: 'Mondadientes', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-PORTA-VASOS', name: 'Porta Vasos', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-INDIVIDUALES', name: 'Individuales', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-BOLSAS-LLEVAR', name: 'Bolsas para Llevar', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-PITILLOS-NEGROS', name: 'Pitillos Gruesos Negros', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-PITILLOS-FINOS', name: 'Pitillos Finos', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-BOLSAS-COTUFAS', name: 'Bolsas de Cotufas', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-TAPAS-VASOS-CAFE', name: 'Tapas para Vasos de Café', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-VASOS-CAFE', name: 'Vasos para Café', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-SERVILLETAS', name: 'Servilletas', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-VASOS', name: 'Vasos', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-PLATOS-10UNI', name: 'Platos 10 uni', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-TENEDORES', name: 'Tenedores Plásticos', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-CUCHARILLAS', name: 'Cucharillas Pequeñas Plásticas', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-CUCHILLOS', name: 'Cuchillos Plásticos', category: 'PLASTICOS', baseUnit: 'UNIT' },
    { sku: 'PLA-VASOS-ROJOS', name: 'Vasos Rojos', category: 'PLASTICOS', baseUnit: 'UNIT' },
];

async function main() {
    console.log('🌱 Cargando SKUs de inventario (sin cantidades)...\n');

    const areas = await prisma.area.findMany({ select: { id: true, name: true } });
    if (areas.length === 0) {
        console.error('❌ No hay áreas. Ejecuta primero: npm run db:seed');
        process.exit(1);
    }

    let created = 0;
    let skipped = 0;

    for (const item of ITEMS) {
        try {
            const existing = await prisma.inventoryItem.findUnique({ where: { sku: item.sku } });
            if (existing) {
                console.log(`⏭️  ${item.sku} - ${item.name} (ya existe)`);
                skipped++;
                continue;
            }

            const newItem = await prisma.inventoryItem.create({
                data: {
                    sku: item.sku,
                    name: item.name,
                    type: 'RAW_MATERIAL',
                    category: item.category,
                    baseUnit: item.baseUnit,
                    isBeverage: item.isBeverage ?? false,
                },
            });

            for (const area of areas) {
                await prisma.inventoryLocation.upsert({
                    where: {
                        inventoryItemId_areaId: {
                            inventoryItemId: newItem.id,
                            areaId: area.id,
                        },
                    },
                    create: {
                        inventoryItemId: newItem.id,
                        areaId: area.id,
                        currentStock: 0,
                    },
                    update: {},
                });
            }

            console.log(`✅ ${item.sku} - ${item.name} [${item.category}]`);
            created++;
        } catch (err) {
            console.error(`❌ ${item.sku}:`, err);
        }
    }

    console.log(`\n📊 Resumen: ${created} creados, ${skipped} ya existían`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
