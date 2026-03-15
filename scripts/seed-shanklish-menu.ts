import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌿 Creando categoría y menú Shanklish Caracas...');

    // ── CATEGORÍA ──────────────────────────────────────────────────────────────
    let cat = await prisma.menuCategory.findFirst({
        where: { name: { contains: 'Shanklish Caracas', mode: 'insensitive' } }
    });

    if (!cat) {
        cat = await prisma.menuCategory.create({
            data: { name: 'Shanklish Caracas', sortOrder: 20, isActive: true }
        });
        console.log('✅ Categoría creada:', cat.name);
    } else {
        console.log('ℹ️  Categoría ya existe:', cat.name);
    }

    const categoryId = cat.id;

    // ── ITEMS ──────────────────────────────────────────────────────────────────
    const items = [
        // ORIGINALES
        { sku: 'SHNK-ORIG-12',         name: 'Shanklish (12")',                   price: 12.00 },
        { sku: 'SHNK-PICA-12',         name: 'Shanklish Picante (12")',           price: 12.00 },

        // SHANKLISH PREPARADOS
        { sku: 'SHNK-TRAD-125',        name: 'Shanklish Traditional 125gr',       price: 7.50  },
        { sku: 'SHNK-TRAD-250',        name: 'Shanklish Traditional 250gr',       price: 12.00 },
        { sku: 'SHNK-TRAD-500',        name: 'Shanklish Traditional 500gr',       price: 22.50 },
        { sku: 'SHNK-PICAP-125',       name: 'Shanklish Picante 125gr',           price: 7.50  },
        { sku: 'SHNK-PICAP-250',       name: 'Shanklish Picante 250gr',           price: 12.00 },
        { sku: 'SHNK-TOMATE-125',      name: 'Shanklish Tomato Seco 125gr',       price: 7.50  },
        { sku: 'SHNK-TOMATE-250',      name: 'Shanklish Tomato Seco 250gr',       price: 12.00 },
        { sku: 'SHNK-PESTO-125',       name: 'Shanklish Pesto 125gr',             price: 7.50  },
        { sku: 'SHNK-PESTO-250',       name: 'Shanklish Pesto 250gr',             price: 12.00 },
        { sku: 'SHNK-MEREY-125',       name: 'Shanklish con Merey 125gr',         price: 7.50  },
        { sku: 'SHNK-MEREY-250',       name: 'Shanklish con Merey 250gr',         price: 12.00 },

        // PLATOS PRINCIPALES
        { sku: 'SHNK-KIBCR-250',       name: 'Kibbe Crudo 250gr',                 price: 12.00 },
        { sku: 'SHNK-KIBCR-500',       name: 'Kibbe Crudo 500gr',                 price: 22.50 },
        { sku: 'SHNK-KIBFR-5',         name: 'Kibbe Frito (5 und)',               price: 12.00 },
        { sku: 'SHNK-KIBFR-10',        name: 'Kibbe Frito (10 und)',              price: 22.50 },
        { sku: 'SHNK-KIBMINI-10',      name: 'Mini Kibbe Frito (10 und)',         price: 12.00 },
        { sku: 'SHNK-KIBMINI-20',      name: 'Mini Kibbe Frito (20 und)',         price: 22.50 },
        { sku: 'SHNK-KIBHORNO-250',    name: 'Kibbe Horneado 250gr',              price: 12.00 },
        { sku: 'SHNK-KIBHORNO-500',    name: 'Kibbe Horneado 500gr',              price: 22.50 },
        { sku: 'SHNK-FALAFEL-7',       name: 'Falafel (7 und)',                   price: 10.50 },
        { sku: 'SHNK-FALAFEL-14',      name: 'Falafel (14 und)',                  price: 19.50 },
        { sku: 'SHNK-PINCHO-POLLO',    name: 'Pincho Pollo (x3)',                 price: 15.00 },
        { sku: 'SHNK-PINCHO-CARNE',    name: 'Pincho Carne (x3)',                 price: 15.00 },
        { sku: 'SHNK-PINCHO-MIXTO',    name: 'Pincho Mixto (x3)',                 price: 15.00 },
        { sku: 'SHNK-ARROZ-250',       name: 'Arroz con Pollo Libanés 250gr',     price: 10.50 },
        { sku: 'SHNK-ARROZ-500',       name: 'Arroz con Pollo Libanés 500gr',     price: 19.50 },
        { sku: 'SHNK-TABAQ-7',         name: 'Tabaquitos (7 und)',                price: 9.00  },
        { sku: 'SHNK-TABAQ-14',        name: 'Tabaquitos (14 und)',               price: 16.50 },

        // SHAWARMAS SHANKLISH
        { sku: 'SHNK-SHWSC-HALF',      name: 'Shawarma Shanklish Caracas Half',   price: 10.50 },
        { sku: 'SHNK-SHWSC-350',       name: 'Shawarma Shanklish Caracas 350gr',  price: 15.00 },
        { sku: 'SHNK-SHWSC-FULL',      name: 'Shawarma Shanklish Caracas Full',   price: 19.50 },
        { sku: 'SHNK-SHWPOLLO-HALF',   name: 'Shawarma Pollo Half',               price: 9.00  },
        { sku: 'SHNK-SHWPOLLO-350',    name: 'Shawarma Pollo 350gr',              price: 13.50 },
        { sku: 'SHNK-SHWPOLLO-FULL',   name: 'Shawarma Pollo Full',               price: 18.00 },
        { sku: 'SHNK-SHWCARNE-HALF',   name: 'Shawarma Carne Half',               price: 10.50 },
        { sku: 'SHNK-SHWCARNE-350',    name: 'Shawarma Carne 350gr',              price: 15.00 },
        { sku: 'SHNK-SHWCARNE-FULL',   name: 'Shawarma Carne Full',               price: 19.50 },
        { sku: 'SHNK-SHWMIX-HALF',     name: 'Shawarma Mixto Half',               price: 10.50 },
        { sku: 'SHNK-SHWMIX-350',      name: 'Shawarma Mixto 350gr',              price: 15.00 },
        { sku: 'SHNK-SHWMIX-FULL',     name: 'Shawarma Mixto Full',               price: 19.50 },
        { sku: 'SHNK-SHWSKFL-HALF',    name: 'Shawarma Shakifel Half',            price: 10.50 },
        { sku: 'SHNK-SHWSKFL-350',     name: 'Shawarma Shakifel 350gr',           price: 15.00 },
        { sku: 'SHNK-SHWSKFL-FULL',    name: 'Shawarma Shakifel Full',            price: 19.50 },
        { sku: 'SHNK-SHWFLFL-HALF',    name: 'Shawarma Falafel Half',             price: 9.00  },
        { sku: 'SHNK-SHWFLFL-350',     name: 'Shawarma Falafel 350gr',            price: 13.50 },
        { sku: 'SHNK-SHWFLFL-FULL',    name: 'Shawarma Falafel Full',             price: 18.00 },

        // PLATOS ESPECIALES
        { sku: 'SHNK-BURGER-350',      name: 'Burger Árabe Shanklish (350gr)',    price: 15.00 },
        { sku: 'SHNK-PIZZA-5',         name: 'Mini Pizza Zaatar (5 und)',         price: 4.50  },
        { sku: 'SHNK-PIZZA-8',         name: 'Mini Pizza Zaatar (8 und)',         price: 7.50  },
        { sku: 'SHNK-SAMBOU-3',        name: 'Sambousek (3 und)',                 price: 7.50  },
        { sku: 'SHNK-SAMBOU-5',        name: 'Sambousek (5 und)',                 price: 12.00 },
        { sku: 'SHNK-BAST-PEQ',        name: 'Basturma Porción Pequeña',          price: 9.00  },
        { sku: 'SHNK-BAST-GRD',        name: 'Basturma Porción Grande',           price: 15.00 },

        // ENSALADAS
        { sku: 'SHNK-TABU-125',        name: 'Tabule 125gr',                      price: 7.50  },
        { sku: 'SHNK-TABU-250',        name: 'Tabule 250gr',                      price: 10.50 },
        { sku: 'SHNK-FATTOUSH-125',    name: 'Fattoush 125gr',                    price: 7.50  },
        { sku: 'SHNK-FATTOUSH-250',    name: 'Fattoush 250gr',                    price: 10.50 },
        { sku: 'SHNK-FATULE-250',      name: 'Fatule 250gr',                      price: 12.00 },

        // CREMAS
        { sku: 'SHNK-HUMMESP-125',     name: 'Hummus Especial 125gr',             price: 9.00  },
        { sku: 'SHNK-HUMMESP-250',     name: 'Hummus Especial 250gr',             price: 15.00 },
        { sku: 'SHNK-HUMMTRAD-125',    name: 'Hummus Tradicional 125gr',          price: 7.50  },
        { sku: 'SHNK-HUMMTRAD-250',    name: 'Hummus Tradicional 250gr',          price: 12.00 },
        { sku: 'SHNK-BABA-125',        name: 'Babaganoush 125gr',                 price: 7.50  },
        { sku: 'SHNK-BABA-250',        name: 'Babaganoush 250gr',                 price: 12.00 },
        { sku: 'SHNK-MUHAM-125',       name: 'Muhammara 125gr',                   price: 7.50  },
        { sku: 'SHNK-MUHAM-250',       name: 'Muhammara 250gr',                   price: 12.00 },
        { sku: 'SHNK-TARATOR-125',     name: 'Tarator (Crema Ajonjolí) 125gr',   price: 7.50  },
        { sku: 'SHNK-TARATOR-250',     name: 'Tarator (Crema Ajonjolí) 250gr',   price: 12.00 },
        { sku: 'SHNK-TOUM-125',        name: 'Toum (Crema de Ajo) 125gr',        price: 7.50  },
        { sku: 'SHNK-TOUM-250',        name: 'Toum (Crema de Ajo) 250gr',        price: 12.00 },
        { sku: 'SHNK-LABNEH-125',      name: 'Labneh 125gr',                      price: 7.50  },
        { sku: 'SHNK-LABNEH-250',      name: 'Labneh 250gr',                      price: 12.00 },
        { sku: 'SHNK-LABANKHIAR-125',  name: 'Laban bi Khiar 125gr',              price: 7.50  },
        { sku: 'SHNK-LABANKHIAR-250',  name: 'Laban bi Khiar 250gr',              price: 12.00 },

        // RACIONES
        { sku: 'SHNK-PAN-1',           name: 'Pan Árabe (1 und)',                 price: 3.00  },
        { sku: 'SHNK-PAN-BOLSA',       name: 'Pan Árabe (bolsa)',                 price: 6.00  },
        { sku: 'SHNK-PAN-TOST',        name: 'Pan Árabe Tostado',                 price: 3.00  },
        { sku: 'SHNK-PAN-FRITO',       name: 'Pan Árabe Frito',                   price: 4.50  },
        { sku: 'SHNK-PAPAS',           name: 'Papas Fritas',                      price: 4.50  },
        { sku: 'SHNK-PAPAS-TRUF',      name: 'Papas Fritas Truffle',              price: 6.00  },

        // DULCES
        { sku: 'SHNK-BAKLAVA-3',       name: 'Baklava (3 und)',                   price: 7.50  },
        { sku: 'SHNK-BAKLAVA-5',       name: 'Baklava (5 und)',                   price: 12.00 },
        { sku: 'SHNK-CHEESEC-FRESA',   name: 'Cheese Cake Fresa',                 price: 9.00  },
        { sku: 'SHNK-CHEESEC-PIST',    name: 'Cheese Cake Pistacho',              price: 9.00  },
        { sku: 'SHNK-HELADO-PEQ',      name: 'Helado Lata Pequeña',               price: 9.00  },
        { sku: 'SHNK-HELADO-GRD',      name: 'Helado Lata Grande',                price: 15.00 },
        { sku: 'SHNK-BROOKIE',         name: 'Brookie',                           price: 9.00  },
    ];

    let created = 0;
    let skipped = 0;

    for (const item of items) {
        const existing = await prisma.menuItem.findUnique({ where: { sku: item.sku } });
        if (existing) {
            skipped++;
            continue;
        }

        await prisma.menuItem.create({
            data: {
                sku: item.sku,
                name: item.name,
                price: item.price,
                categoryId,
                isAvailable: true,
                isActive: true,
                serviceCategory: 'FOOD',
                kitchenRouting: 'KITCHEN',
            }
        });
        created++;
        console.log(`  ✅ ${item.name} — $${item.price}`);
    }

    console.log(`\n🎉 Listo. Creados: ${created} | Omitidos (ya existen): ${skipped}`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
