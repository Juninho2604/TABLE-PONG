/**
 * SETUP COMPLETO DE COCTELES - TABLE PONG
 * =========================================
 * Este script hace 3 cosas:
 *   1. Agrega/actualiza insumos de barra faltantes (en ML para licores, g para solidos)
 *   2. Crea todas las recetas de cocteles con ingredientes vinculados al inventario
 *   3. Crea los items del menu POS vinculados a sus recetas
 *
 * Ejecutar: npx tsx scripts/setup-cocteles-tablepong.ts
 *
 * CONVERSION BASE: 1 Oz = 29.57 ml ≈ 30 ml (valor practico de barra)
 * NOTA: Los licores principales (botellas) se mantienen como UNIT en inventario
 *       con conversionRate = 750 (1 botella = 750 ml).
 *       Los insumos de barra (jarabes, jugos) se registran directamente en ML.
 */

import 'dotenv/config';
import ws from 'ws';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// Usar WebSockets — el puerto 5432 esta bloqueado en esta maquina
neonConfig.webSocketConstructor = ws;
const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
const _adapter = new PrismaNeon(_pool);
const prisma = new PrismaClient({ adapter: _adapter });

// ─── AREA DE BARRA ────────────────────────────────────────────────────────────
const BARRA_AREA_ID = 'area-barra-principal';

// ─── INSUMOS FALTANTES ───────────────────────────────────────────────────────
// Estos insumos NO existen en el inventario actual y son necesarios para los cocteles.
// Se registran con baseUnit=ML para poder descargar porciones exactas.
const MISSING_INGREDIENTS = [
  // Licores faltantes (botellas = UNIT con conversionRate 750ml)
  { sku: 'LIC-KAHLUA',         name: 'Kahlua (Licor de Cafe)',   category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-CAMPARI',        name: 'Campari',                  category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-SAMBUCA',        name: 'Sambuca',                  category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-RON-BLANCO',     name: 'Ron Blanco',               category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-RON-DORADO',     name: 'Ron Dorado',               category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-DISARONNO',      name: 'Disaronno (Amaretto)',     category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-TEQUILA-SILVER', name: 'Tequila Silver',           category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },
  { sku: 'LIC-PROSECCO',       name: 'Prosecco / Espumante',     category: 'LICORES', baseUnit: 'UNIT', conversionRate: 750, purchaseUnit: 'UNIT', isBeverage: true },

  // Insumos de barra liquidos (ML directos — se compran por litro o unidad pero se miden en ML)
  { sku: 'BAR-JARABE-SIMPLE',  name: 'Jarabe Simple',            category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },
  { sku: 'BAR-JARABE-JENGIBRE',name: 'Jarabe de Jengibre',       category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },
  { sku: 'BAR-JARABE-MORA',    name: 'Jarabe de Mora',           category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },
  { sku: 'BAR-JUGO-LIMON',     name: 'Jugo de Limon Fresco',     category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },
  { sku: 'BAR-JUGO-ARANDANO',  name: 'Jugo de Arandano',        category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },
  { sku: 'BAR-JUGO-TORONJA',   name: 'Jugo de Toronja Fresco',  category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },
  { sku: 'BAR-CAFE-ESPRESSO',  name: 'Cafe Espresso',            category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'L',    isBeverage: false },

  // Insumos de barra solidos (G)
  { sku: 'BAR-AZUCAR',         name: 'Azucar (Barra)',           category: 'BARRA',   baseUnit: 'G',    conversionRate: null, purchaseUnit: 'KG',   isBeverage: false },
  { sku: 'BAR-HIELO',          name: 'Hielo',                    category: 'BARRA',   baseUnit: 'G',    conversionRate: null, purchaseUnit: 'KG',   isBeverage: false },
  { sku: 'BAR-HIERBABUENA',    name: 'Hojas de Hierbabuena',     category: 'BARRA',   baseUnit: 'UNIT', conversionRate: null, purchaseUnit: 'UNIT', isBeverage: false },
  { sku: 'BAR-CLARA-HUEVO',    name: 'Clara de Huevo',           category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'UNIT', isBeverage: false },
  { sku: 'BAR-LIMON-FRESCO',   name: 'Limon Fresco (Barra)',     category: 'BARRA',   baseUnit: 'G',    conversionRate: null, purchaseUnit: 'KG',   isBeverage: false },
  { sku: 'BAR-PINA-PULPA',     name: 'Pina (pulpa/trozos)',      category: 'BARRA',   baseUnit: 'G',    conversionRate: null, purchaseUnit: 'KG',   isBeverage: false },
  { sku: 'BAR-HELADO-MANTECADO', name: 'Helado Mantecado',       category: 'BARRA',   baseUnit: 'ML',   conversionRate: null, purchaseUnit: 'UNIT', isBeverage: false },
];

// ─── RECETAS DE COCTELES ──────────────────────────────────────────────────────
// Formato de cantidad para licores botella: qty en FRACCIONES DE BOTELLA
// Ejemplo: 60ml de vodka de botella 750ml = 60/750 = 0.08 botellas
// Para insumos en ML directamente: qty en ML exactos
//
// Estrategia simplificada: todos los ingredientes se expresan en su baseUnit
// Licores (UNIT/botella): qty = ml_requeridos / 750
// Insumos ML directos: qty = ml_exactos
// Insumos G: qty = gramos_exactos
// Insumos UNIT (hojas): qty = unidades

const COCKTAIL_RECIPES = [
  // ── TRAGOS SIMPLES ──────────────────────────────────────────────────────────
  {
    sku: 'REC-TRAGO-VODKA', name: 'Trago de Vodka', type: 'COCKTAIL',
    outputSku: 'LIC-GORDONS-VODKA',
    ingredients: [{ sku: 'LIC-GORDONS-VODKA', qty: 60/750, unit: 'UNIT' }],
  },
  {
    sku: 'REC-TRAGO-WHISKEY', name: 'Trago de Whiskey', type: 'COCKTAIL',
    outputSku: 'LIC-BUCHANAS-12',
    ingredients: [{ sku: 'LIC-BUCHANAS-12', qty: 60/750, unit: 'UNIT' }],
  },
  {
    sku: 'REC-TRAGO-RON', name: 'Trago de Ron', type: 'COCKTAIL',
    outputSku: 'LIC-RON-BLANCO',
    ingredients: [{ sku: 'LIC-RON-BLANCO', qty: 60/750, unit: 'UNIT' }],
  },
  {
    sku: 'REC-TRAGO-GINEBRA', name: 'Trago de Ginebra', type: 'COCKTAIL',
    outputSku: 'LIC-TANQUEREI',
    ingredients: [{ sku: 'LIC-TANQUEREI', qty: 60/750, unit: 'UNIT' }],
  },
  {
    sku: 'REC-TRAGO-SAMBUCA', name: 'Trago de Sambuca', type: 'COCKTAIL',
    outputSku: 'LIC-SAMBUCA',
    ingredients: [{ sku: 'LIC-SAMBUCA', qty: 60/750, unit: 'UNIT' }],
  },
  {
    sku: 'REC-TRAGO-AMARETTO', name: 'Trago de Amaretto', type: 'COCKTAIL',
    outputSku: 'LIC-AMARETTO',
    ingredients: [{ sku: 'LIC-AMARETTO', qty: 60/750, unit: 'UNIT' }],
  },

  // ── ESPECIALES ──────────────────────────────────────────────────────────────
  {
    sku: 'REC-DISARONNO-SOUR', name: 'Disaronno Sour', type: 'COCKTAIL',
    outputSku: 'LIC-DISARONNO',
    ingredients: [
      { sku: 'LIC-DISARONNO',    qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JUGO-LIMON',   qty: 30,     unit: 'ML'   },
      { sku: 'BAR-CLARA-HUEVO',  qty: 30,     unit: 'ML'   },
    ],
  },
  {
    sku: 'REC-ESPRESSO-MARTINI', name: 'Espresso Martini', type: 'COCKTAIL',
    outputSku: 'LIC-GORDONS-VODKA',
    ingredients: [
      { sku: 'LIC-GORDONS-VODKA', qty: 60/750, unit: 'UNIT' },
      { sku: 'LIC-KAHLUA',        qty: 30/750, unit: 'UNIT' },
      { sku: 'BAR-CAFE-ESPRESSO', qty: 30,     unit: 'ML'   },
    ],
  },

  // ── COCTELES CLASICOS ───────────────────────────────────────────────────────
  {
    sku: 'REC-TINTO-VERANO', name: 'Tinto de Verano', type: 'COCKTAIL',
    outputSku: 'LIC-FINCA-MORAS',
    ingredients: [
      { sku: 'LIC-FINCA-MORAS',  qty: 120/750, unit: 'UNIT' },
      { sku: 'BEB-SEVEN-UP',     qty: 0.5,     unit: 'UNIT' }, // media lata/botella 7up
      { sku: 'BAR-HIELO',        qty: 210,     unit: 'G'    },
    ],
  },
  {
    sku: 'REC-MOJITO', name: 'Mojito', type: 'COCKTAIL',
    outputSku: 'LIC-RON-BLANCO',
    ingredients: [
      { sku: 'LIC-RON-BLANCO',      qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JUGO-LIMON',      qty: 30,     unit: 'ML'   },
      { sku: 'BAR-JARABE-SIMPLE',   qty: 30,     unit: 'ML'   },
      { sku: 'BEB-SODA',            qty: 0.35,   unit: 'UNIT' }, // ~90ml de soda
      { sku: 'BAR-AZUCAR',          qty: 10,     unit: 'G'    },
      { sku: 'BAR-HIERBABUENA',     qty: 5,      unit: 'UNIT' },
      { sku: 'BAR-HIELO',           qty: 150,    unit: 'G'    },
    ],
  },
  {
    sku: 'REC-JAGGER-MOJITO', name: 'Jagger Mojito', type: 'COCKTAIL',
    outputSku: 'LIC-JAGERMEISTER',
    ingredients: [
      { sku: 'LIC-JAGERMEISTER',    qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JUGO-LIMON',      qty: 30,     unit: 'ML'   },
      { sku: 'BAR-JARABE-SIMPLE',   qty: 30,     unit: 'ML'   },
      { sku: 'BEB-SODA',            qty: 0.35,   unit: 'UNIT' },
      { sku: 'BAR-HIERBABUENA',     qty: 5,      unit: 'UNIT' },
      { sku: 'BAR-HIELO',           qty: 150,    unit: 'G'    },
    ],
  },
  {
    sku: 'REC-DAIQUIRI', name: 'Daiquiri', type: 'COCKTAIL',
    outputSku: 'LIC-RON-DORADO',
    ingredients: [
      { sku: 'LIC-RON-DORADO',      qty: 60/750,  unit: 'UNIT' },
      { sku: 'BAR-JUGO-LIMON',      qty: 22,      unit: 'ML'   },
      { sku: 'BAR-AZUCAR',          qty: 80,      unit: 'G'    },
      { sku: 'BAR-PINA-PULPA',      qty: 200,     unit: 'G'    }, // variable segun fruta
    ],
  },
  {
    sku: 'REC-GIN-TONIC', name: 'Gin Tonic', type: 'COCKTAIL',
    outputSku: 'LIC-TANQUEREI',
    ingredients: [
      { sku: 'LIC-TANQUEREI',      qty: 60/750,  unit: 'UNIT' },
      { sku: 'BEB-AGUAKINA',       qty: 0.5,     unit: 'UNIT' }, // ~180ml aguakina
      { sku: 'BAR-JUGO-LIMON',     qty: 8,       unit: 'ML'   },
      { sku: 'BAR-HIELO',          qty: 210,     unit: 'G'    },
    ],
  },
  {
    sku: 'REC-NEGRONI', name: 'Negroni', type: 'COCKTAIL',
    outputSku: 'LIC-TANQUEREI',
    ingredients: [
      { sku: 'LIC-VERMOUTH-ROSSO', qty: 30/750,  unit: 'UNIT' },
      { sku: 'LIC-TANQUEREI',      qty: 30/750,  unit: 'UNIT' },
      { sku: 'LIC-CAMPARI',        qty: 30/750,  unit: 'UNIT' },
      { sku: 'BAR-HIELO',          qty: 150,     unit: 'G'    },
    ],
  },
  {
    sku: 'REC-CLOVER-CLUB', name: 'Clover Club', type: 'COCKTAIL',
    outputSku: 'LIC-BOMBAY-GIN',
    ingredients: [
      { sku: 'LIC-BOMBAY-GIN',      qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-CLARA-HUEVO',     qty: 30,     unit: 'ML'   },
      { sku: 'BAR-JUGO-LIMON',      qty: 15,     unit: 'ML'   },
      { sku: 'BAR-JARABE-MORA',     qty: 30,     unit: 'ML'   },
      { sku: 'BAR-JARABE-SIMPLE',   qty: 15,     unit: 'ML'   },
    ],
  },
  {
    sku: 'REC-MOSCOW-MULE', name: 'Moscow Mule', type: 'COCKTAIL',
    outputSku: 'LIC-GORDONS-VODKA',
    ingredients: [
      { sku: 'LIC-GORDONS-VODKA',    qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JARABE-JENGIBRE',  qty: 22,     unit: 'ML'   },
      { sku: 'BAR-JUGO-LIMON',       qty: 22,     unit: 'ML'   },
    ],
  },
  {
    sku: 'REC-PINA-COLADA', name: 'Piña Colada', type: 'COCKTAIL',
    outputSku: 'LIC-RON-DORADO',
    ingredients: [
      { sku: 'LIC-RON-DORADO',      qty: 60/750, unit: 'UNIT' },
      { sku: 'COM-CREMA-COCO',      qty: 90/400, unit: 'UNIT' }, // ~90ml de lata 400ml
      { sku: 'COM-LECHE-CONDENSADA',qty: 120/395,unit: 'UNIT' }, // ~120ml de lata 395g
      { sku: 'BAR-PINA-PULPA',      qty: 200,    unit: 'G'    },
    ],
  },

  // ── COCTELES ADICIONALES ────────────────────────────────────────────────────
  {
    sku: 'REC-BERLIN-MULE', name: 'Berlin Mule', type: 'COCKTAIL',
    outputSku: 'LIC-JAGERMEISTER',
    ingredients: [
      { sku: 'LIC-JAGERMEISTER',    qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JUGO-LIMON',      qty: 30,     unit: 'ML'   },
      { sku: 'BAR-JARABE-JENGIBRE', qty: 30,     unit: 'ML'   },
    ],
  },
  {
    sku: 'REC-ORGASMO', name: 'Orgasmo', type: 'COCKTAIL',
    outputSku: 'LIC-RON-DORADO',
    ingredients: [
      { sku: 'BAR-HELADO-MANTECADO', qty: 200,    unit: 'ML'   },
      { sku: 'LIC-RON-DORADO',       qty: 30/750, unit: 'UNIT' },
      { sku: 'LIC-KAHLUA',           qty: 30/750, unit: 'UNIT' },
      { sku: 'LIC-AMARETTO',         qty: 30/750, unit: 'UNIT' },
    ],
  },
  {
    sku: 'REC-KAIPIROSKA', name: 'Kaipiroska', type: 'COCKTAIL',
    outputSku: 'LIC-GORDONS-VODKA',
    ingredients: [
      { sku: 'LIC-GORDONS-VODKA',   qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-LIMON-FRESCO',    qty: 80,     unit: 'G'    },
      { sku: 'BAR-AZUCAR',          qty: 80,     unit: 'G'    },
    ],
  },
  {
    sku: 'REC-COSMOPOLITAN', name: 'Cosmopolitan', type: 'COCKTAIL',
    outputSku: 'LIC-GORDONS-VODKA',
    ingredients: [
      { sku: 'LIC-GORDONS-VODKA',   qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JUGO-ARANDANO',   qty: 120,    unit: 'ML'   },
      { sku: 'BAR-JARABE-SIMPLE',   qty: 30,     unit: 'ML'   },
      { sku: 'BAR-JUGO-LIMON',      qty: 30,     unit: 'ML'   },
    ],
  },
  {
    sku: 'REC-PALOMA', name: 'Paloma', type: 'COCKTAIL',
    outputSku: 'LIC-TEQUILA-SILVER',
    ingredients: [
      { sku: 'LIC-TEQUILA-SILVER',  qty: 60/750, unit: 'UNIT' },
      { sku: 'BAR-JUGO-TORONJA',    qty: 120,    unit: 'ML'   },
      { sku: 'BAR-JARABE-SIMPLE',   qty: 15,     unit: 'ML'   },
      { sku: 'BAR-JUGO-LIMON',      qty: 30,     unit: 'ML'   },
    ],
  },
  {
    sku: 'REC-APEROL-SPRITZ', name: 'Aperol Spritz', type: 'COCKTAIL',
    outputSku: 'LIC-APEROL',
    ingredients: [
      { sku: 'LIC-APEROL',          qty: 60/750,  unit: 'UNIT' },
      { sku: 'LIC-PROSECCO',        qty: 120/750, unit: 'UNIT' },
      { sku: 'BEB-SODA',            qty: 0.15,    unit: 'UNIT' },
    ],
  },
];

// ─── MENU ITEMS DEL POS ───────────────────────────────────────────────────────
// Estos son los items que apareceran en el POS para que las cajeras los seleccionen.
// Cada uno esta vinculado a su receta.
const COCKTAIL_MENU_ITEMS = [
  // TRAGOS SIMPLES
  { sku: 'COC-VODKA',         name: 'Vodka (2 Oz)',         price: 6.00,  recipeSku: 'REC-TRAGO-VODKA',      routing: 'BAR' },
  { sku: 'COC-WHISKEY',       name: 'Whiskey (2 Oz)',       price: 8.00,  recipeSku: 'REC-TRAGO-WHISKEY',    routing: 'BAR' },
  { sku: 'COC-RON',           name: 'Ron (2 Oz)',           price: 5.00,  recipeSku: 'REC-TRAGO-RON',        routing: 'BAR' },
  { sku: 'COC-GINEBRA',       name: 'Ginebra (2 Oz)',       price: 6.00,  recipeSku: 'REC-TRAGO-GINEBRA',    routing: 'BAR' },
  { sku: 'COC-SAMBUCA',       name: 'Sambuca (2 Oz)',       price: 6.00,  recipeSku: 'REC-TRAGO-SAMBUCA',    routing: 'BAR' },
  { sku: 'COC-AMARETTO',      name: 'Amaretto (2 Oz)',      price: 6.00,  recipeSku: 'REC-TRAGO-AMARETTO',   routing: 'BAR' },

  // ESPECIALES
  { sku: 'COC-DISARONNO-SOUR',   name: 'Disaronno Sour',      price: 9.00,  recipeSku: 'REC-DISARONNO-SOUR',   routing: 'BAR' },
  { sku: 'COC-ESPRESSO-MARTINI', name: 'Espresso Martini',     price: 9.00,  recipeSku: 'REC-ESPRESSO-MARTINI', routing: 'BAR' },

  // COCTELES
  { sku: 'COC-TINTO-VERANO',  name: 'Tinto de Verano',      price: 7.00,  recipeSku: 'REC-TINTO-VERANO',    routing: 'BAR' },
  { sku: 'COC-MOJITO',        name: 'Mojito',                price: 8.00,  recipeSku: 'REC-MOJITO',           routing: 'BAR' },
  { sku: 'COC-JAGGER-MOJITO', name: 'Jagger Mojito',         price: 9.00,  recipeSku: 'REC-JAGGER-MOJITO',   routing: 'BAR' },
  { sku: 'COC-DAIQUIRI',      name: 'Daiquiri',              price: 8.00,  recipeSku: 'REC-DAIQUIRI',         routing: 'BAR' },
  { sku: 'COC-GIN-TONIC',     name: 'Gin Tonic',             price: 9.00,  recipeSku: 'REC-GIN-TONIC',       routing: 'BAR' },
  { sku: 'COC-NEGRONI',       name: 'Negroni',               price: 9.00,  recipeSku: 'REC-NEGRONI',          routing: 'BAR' },
  { sku: 'COC-CLOVER-CLUB',   name: 'Clover Club',           price: 9.00,  recipeSku: 'REC-CLOVER-CLUB',     routing: 'BAR' },
  { sku: 'COC-MOSCOW-MULE',   name: 'Moscow Mule',           price: 9.00,  recipeSku: 'REC-MOSCOW-MULE',     routing: 'BAR' },
  { sku: 'COC-PINA-COLADA',   name: 'Piña Colada',           price: 9.00,  recipeSku: 'REC-PINA-COLADA',     routing: 'BAR' },
  { sku: 'COC-BERLIN-MULE',   name: 'Berlin Mule',           price: 9.00,  recipeSku: 'REC-BERLIN-MULE',     routing: 'BAR' },
  { sku: 'COC-ORGASMO',       name: 'Orgasmo',               price: 10.00, recipeSku: 'REC-ORGASMO',          routing: 'BAR' },
  { sku: 'COC-KAIPIROSKA',    name: 'Kaipiroska',            price: 8.00,  recipeSku: 'REC-KAIPIROSKA',      routing: 'BAR' },
  { sku: 'COC-COSMOPOLITAN',  name: 'Cosmopolitan',          price: 9.00,  recipeSku: 'REC-COSMOPOLITAN',    routing: 'BAR' },
  { sku: 'COC-PALOMA',        name: 'Paloma',                price: 9.00,  recipeSku: 'REC-PALOMA',           routing: 'BAR' },
  { sku: 'COC-APEROL-SPRITZ', name: 'Aperol Spritz',         price: 9.00,  recipeSku: 'REC-APEROL-SPRITZ',   routing: 'BAR' },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🍹 Iniciando setup de cocteles Table Pong...\n');

  // Obtener usuario admin para createdBy
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER'] } }
  });
  if (!adminUser) { console.error('❌ No se encontró usuario admin'); return; }
  console.log(`✅ Usuario admin: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.role})\n`);

  // ── PASO 1: CREAR/VERIFICAR INSUMOS FALTANTES ──────────────────────────────
  console.log('📦 Paso 1: Creando insumos faltantes en inventario...');
  const itemIdMap: Record<string, string> = {};

  for (const item of MISSING_INGREDIENTS) {
    const existing = await prisma.inventoryItem.findUnique({ where: { sku: item.sku } });
    if (existing) {
      console.log(`  ↳ Ya existe: ${item.name} (${item.sku})`);
      itemIdMap[item.sku] = existing.id;
    } else {
      const created = await prisma.inventoryItem.create({
        data: {
          sku: item.sku,
          name: item.name,
          category: item.category,
          baseUnit: item.baseUnit,
          purchaseUnit: item.purchaseUnit || item.baseUnit,
          conversionRate: item.conversionRate ?? 1,
          isBeverage: item.isBeverage,
          type: 'RAW_MATERIAL',
          isActive: true,
          minimumStock: item.baseUnit === 'UNIT' ? 1 : 500,
        }
      });
      console.log(`  ✅ Creado: ${item.name} (${item.baseUnit})`);
      itemIdMap[created.sku] = created.id;
    }
  }

  // Cargar todos los items existentes en el mapa
  const allItems = await prisma.inventoryItem.findMany({ select: { id: true, sku: true } });
  for (const item of allItems) {
    if (!itemIdMap[item.sku]) itemIdMap[item.sku] = item.id;
  }
  console.log(`\n  Total insumos mapeados: ${Object.keys(itemIdMap).length}\n`);

  // ── PASO 2: CREAR RECETAS DE COCTELES ──────────────────────────────────────
  console.log('🍳 Paso 2: Creando recetas de cocteles...');

  // Buscar o crear categoria de menu "Cocteles y Tragos"
  let menuCat = await prisma.menuCategory.findFirst({
    where: { name: { contains: 'Coctel', mode: 'insensitive' } }
  });
  if (!menuCat) {
    menuCat = await prisma.menuCategory.create({
      data: { name: 'Cocteles y Tragos', sortOrder: 10, isActive: true }
    });
    console.log('  ✅ Categoría de menu creada: Cocteles y Tragos');
  } else {
    console.log(`  ↳ Categoría de menu ya existe: ${menuCat.name}`);
  }

  const recipeIdMap: Record<string, string> = {};

  for (const recipe of COCKTAIL_RECIPES) {
    // Verificar si ya existe
    const existing = await prisma.recipe.findFirst({ where: { name: recipe.name } });
    if (existing) {
      console.log(`  ↳ Receta ya existe: ${recipe.name}`);
      recipeIdMap[recipe.sku] = existing.id;
      continue;
    }

    // Verificar que todos los ingredientes existen
    let allIngredientsOk = true;
    for (const ing of recipe.ingredients) {
      if (!itemIdMap[ing.sku]) {
        console.warn(`  ⚠️  Ingrediente no encontrado para ${recipe.name}: ${ing.sku}`);
        allIngredientsOk = false;
      }
    }
    if (!allIngredientsOk) {
      console.error(`  ❌ Saltando receta ${recipe.name} por ingredientes faltantes`);
      continue;
    }

    // Obtener o usar primer item de ingredientes como outputItem
    const outputItemId = itemIdMap[recipe.outputSku];
    if (!outputItemId) {
      console.warn(`  ⚠️  Output item no encontrado para ${recipe.name}: ${recipe.outputSku}`);
      continue;
    }

    const created = await prisma.recipe.create({
      data: {
        name: recipe.name,
        recipeType: recipe.type,
        outputItemId,
        outputQuantity: 1,
        outputUnit: 'UNIT',
        isApproved: true,
        isActive: true,
        ingredients: {
          create: recipe.ingredients.map(ing => ({
            ingredientItemId: itemIdMap[ing.sku],
            quantity: ing.qty,
            unit: ing.unit,
          }))
        }
      }
    });
    recipeIdMap[recipe.sku] = created.id;
    console.log(`  ✅ Receta creada: ${recipe.name} (${recipe.ingredients.length} ingredientes)`);
  }

  // ── PASO 3: CREAR MENU ITEMS EN EL POS ─────────────────────────────────────
  console.log('\n🍽️  Paso 3: Creando items en el menu del POS...');

  for (const item of COCKTAIL_MENU_ITEMS) {
    const existing = await prisma.menuItem.findUnique({ where: { sku: item.sku } });
    if (existing) {
      // Actualizar recipeId si esta vacio
      if (!existing.recipeId && recipeIdMap[item.recipeSku]) {
        await prisma.menuItem.update({
          where: { sku: item.sku },
          data: {
            recipeId: recipeIdMap[item.recipeSku],
            serviceCategory: 'COCKTAIL',
            kitchenRouting: item.routing,
          }
        });
        console.log(`  🔗 Vinculado con receta: ${item.name}`);
      } else {
        console.log(`  ↳ Ya existe: ${item.name}`);
      }
      continue;
    }

    await prisma.menuItem.create({
      data: {
        sku: item.sku,
        name: item.name,
        price: item.price,
        categoryId: menuCat.id,
        recipeId: recipeIdMap[item.recipeSku] || null,
        serviceCategory: 'COCKTAIL',
        kitchenRouting: item.routing,
        isAvailable: true,
        isActive: true,
        cost: null, // Se calcula automaticamente por el sistema
      }
    });
    console.log(`  ✅ Creado en POS: ${item.name} ($${item.price})`);
  }

  // ── RESUMEN FINAL ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅ SETUP COMPLETADO');
  console.log('═'.repeat(60));
  console.log(`  Insumos procesados : ${MISSING_INGREDIENTS.length}`);
  console.log(`  Recetas creadas    : ${COCKTAIL_RECIPES.length}`);
  console.log(`  Items en POS       : ${COCKTAIL_MENU_ITEMS.length}`);
  console.log('\n  ⚠️  IMPORTANTE: Los precios de los cocteles en el POS son');
  console.log('  ESTIMADOS. Deben ser ajustados segun los precios reales del local.');
  console.log('\n  ⚠️  Los licores siguen tracked como UNIT (botellas).');
  console.log('  El descargo de inventario ocurre en fracciones de botella.');
  console.log('  Ejemplo: 1 Mojito descarga 0.08 botellas de Ron Blanco (60ml/750ml).');
  console.log('═'.repeat(60));
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await _pool.end(); });
