import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed Table Pong...');

    // 1. Usuarios
    await prisma.user.upsert({
        where: { email: 'admin@tablepong.com' },
        update: {},
        create: {
            email: 'admin@tablepong.com',
            firstName: 'Admin',
            lastName: 'Table Pong',
            role: 'OWNER',
            passwordHash: 'tablepong123',
            pin: '1234',
        },
    });
    await prisma.user.upsert({
        where: { email: 'cajero@tablepong.com' },
        update: {},
        create: {
            email: 'cajero@tablepong.com',
            firstName: 'Cajero',
            lastName: 'Table Pong',
            role: 'CASHIER_RESTAURANT',
            passwordHash: 'tablepong123',
        },
    });
    await prisma.user.upsert({
        where: { email: 'chef@tablepong.com' },
        update: {},
        create: {
            email: 'chef@tablepong.com',
            firstName: 'Chef',
            lastName: 'Table Pong',
            role: 'CHEF',
            passwordHash: 'tablepong123',
        },
    });
    console.log('✅ Usuarios creados');

    // 2. Áreas / Almacenes
    const areas = [
        { id: 'area-oficina-tp', name: 'OFICINA', description: 'Oficina principal' },
        { id: 'area-barra-tp', name: 'BARRA', description: 'Barra principal' },
        { id: 'area-deposito-barra-tp', name: 'DEPOSITO BARRA', description: 'Depósito de barra' },
        { id: 'area-deposito-store-tp', name: 'DEPOSITO STORE', description: 'Depósito tienda' },
    ];
    for (const a of areas) {
        await prisma.area.upsert({
            where: { id: a.id },
            update: { name: a.name, description: a.description },
            create: a,
        });
    }
    console.log('✅ Áreas creadas');

    // 3. Menús - Categorías e ítems
    const categories: { name: string; sortOrder: number; items: { sku: string; name: string; price: number; serviceCategory?: string }[] }[] = [
        // MENÚ PRINCIPAL
        {
            name: 'ESPECIALIDADES DE LA CASA',
            sortOrder: 10,
            items: [
                { sku: 'TP-CACHAPA-QUE', name: 'Cachapa con Queso', price: 7.5, serviceCategory: 'FOOD' },
            ],
        },
        {
            name: 'HOT DOGS',
            sortOrder: 20,
            items: [
                { sku: 'TP-HOTDOG-TRAD', name: 'Hot Dog Tradicional', price: 4.5, serviceCategory: 'FOOD' },
            ],
        },
        {
            name: 'SNACKS',
            sortOrder: 30,
            items: [
                { sku: 'TP-COTUFAS-P', name: 'Cotufas Pequeñas', price: 1.5, serviceCategory: 'FOOD' },
                { sku: 'TP-COTUFAS-G', name: 'Cotufas Grandes', price: 3, serviceCategory: 'FOOD' },
                { sku: 'TP-CHUCHERIAS', name: 'Chucherías PepsiCo', price: 1.5, serviceCategory: 'FOOD' },
            ],
        },
        {
            name: 'ARGUILE',
            sortOrder: 40,
            items: [
                { sku: 'TP-ARGUILE-SERV', name: 'Servicio de Argule', price: 30, serviceCategory: 'SERVICE' },
                { sku: 'TP-ARGUILE-REC', name: 'Recarga Argule', price: 7.5, serviceCategory: 'SERVICE' },
            ],
        },
        {
            name: 'CERVEZAS',
            sortOrder: 50,
            items: [
                { sku: 'TP-CERV-POLAR', name: 'Polarcita', price: 1.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-SOL-V', name: 'Solera Verde', price: 1.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-SOL-A', name: 'Solera Azul', price: 1.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-CORONA', name: 'Corona', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-BUD', name: 'Budweiser', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-HEINE', name: 'Heineken', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-PRES', name: 'Presidente', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-MOD', name: 'Modelo', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-STELLA', name: 'Stella', price: 4.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-CERV-TOBO', name: 'Tobo de Cervezas (Polar/Solera)', price: 12, serviceCategory: 'PACKAGED_DRINK' },
            ],
        },
        {
            name: 'BEBIDAS',
            sortOrder: 60,
            items: [
                { sku: 'TP-BEB-JUGOS', name: 'Jugos', price: 4.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-LIMON', name: 'Limonada con Hierbabuena', price: 4.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-LIPT-L', name: 'Lipton Limón', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-LIPT-D', name: 'Lipton Durazno', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-GATOR', name: 'Gatorade', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-7UP', name: '7UP', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-PEPSI', name: 'Pepsi', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-AGUA-SP', name: 'Agua Sparkling', price: 3, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-AGUA-P', name: 'Agua Pequeña', price: 1.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-BEB-AGUA-G', name: 'Agua Grande', price: 3, serviceCategory: 'PACKAGED_DRINK' },
            ],
        },
        {
            name: 'CAFÉS',
            sortOrder: 70,
            items: [
                { sku: 'TP-CAF-CAP-P', name: 'Cappuccino Pequeño', price: 3, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-CAP-G', name: 'Cappuccino Grande', price: 4.5, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-LATTE', name: 'Latte', price: 4.5, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-MOCA', name: 'Moccaccino', price: 4.5, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-AMER-P', name: 'Americano Pequeño', price: 3, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-AMER-G', name: 'Americano Grande', price: 4.5, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-EXP-S', name: 'Expresso Simple', price: 3, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-EXP-D', name: 'Expresso Doble', price: 4.5, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-MACCH', name: 'Macchiato', price: 4.5, serviceCategory: 'FOOD' },
                { sku: 'TP-CAF-ARAB', name: 'Café Árabe', price: 4.5, serviceCategory: 'FOOD' },
            ],
        },
        {
            name: 'POSTRES',
            sortOrder: 80,
            items: [
                { sku: 'TP-POST-MANT', name: 'Helado de Mantecado', price: 1.5, serviceCategory: 'FOOD' },
                { sku: 'TP-POST-CHOC', name: 'Helado de Chocolate', price: 1.5, serviceCategory: 'FOOD' },
            ],
        },
        {
            name: 'EXTRAS',
            sortOrder: 90,
            items: [
                { sku: 'TP-EXT-CARORE', name: 'Caroreña de Lata', price: 1.5, serviceCategory: 'PACKAGED_DRINK' },
                { sku: 'TP-EXT-POLAR-P', name: 'Polar Pilsen de Lata', price: 1.5, serviceCategory: 'PACKAGED_DRINK' },
            ],
        },
        // LICORES - VODKA
        {
            name: 'VODKA',
            sortOrder: 100,
            items: [
                { sku: 'TP-VOD-GORDON-T', name: "Gordon's - Trago", price: 6, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VOD-GORDON-S', name: "Gordon's - Servicio", price: 30, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VOD-STOLI-T', name: 'Stolichnaya - Trago', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VOD-STOLI-S', name: 'Stolichnaya - Servicio', price: 60, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VOD-GREY-T', name: 'Grey Goose - Trago', price: 13.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VOD-GREY-S', name: 'Grey Goose - Servicio', price: 120, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VOD-DESCOR', name: 'Descorche de Vodka', price: 22.5, serviceCategory: 'SERVICE' },
            ],
        },
        // RON
        {
            name: 'RON',
            sortOrder: 110,
            items: [
                { sku: 'TP-RON-ST-GR-T', name: 'Santa Teresa Gran Reserva - Trago', price: 6, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-ST-GR-S', name: 'Santa Teresa Gran Reserva - Servicio', price: 30, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-ST-LIN-T', name: 'Santa Teresa Linaje - Trago', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-ST-LIN-S', name: 'Santa Teresa Linaje - Servicio', price: 45, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-ST-1796-T', name: 'Santa Teresa 1796 - Trago', price: 12, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-ST-1796-S', name: 'Santa Teresa 1796 - Servicio', price: 75, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-CAC-500-T', name: 'Cacique 500 - Trago', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-CAC-500-S', name: 'Cacique 500 - Servicio', price: 60, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-RON-DESCOR', name: 'Descorche de Ron', price: 22.5, serviceCategory: 'SERVICE' },
            ],
        },
        // WHISKY
        {
            name: 'WHISKY',
            sortOrder: 120,
            items: [
                { sku: 'TP-WHIS-BUCH-T', name: 'Buchanans 12 Años - Trago', price: 12, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-WHIS-BUCH-S', name: 'Buchanans 12 Años - Servicio', price: 75, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-WHIS-OLD-T', name: 'Old Parr 12 Años - Trago', price: 12, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-WHIS-OLD-S', name: 'Old Parr 12 Años - Servicio', price: 67.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-WHIS-DESCOR', name: 'Descorche de Whisky', price: 22.5, serviceCategory: 'SERVICE' },
            ],
        },
        // ESPECIALES
        {
            name: 'ESPECIALES',
            sortOrder: 130,
            items: [
                { sku: 'TP-ESP-CUERVO-S', name: 'Jose Cuervo Silver - Shot', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-CUERVO-T', name: 'Jose Cuervo Silver - Trago', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-CUERVO-SV', name: 'Jose Cuervo Silver - Servicio', price: 60, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-CUERV-R-S', name: 'Jose Cuervo Reposado - Shot', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-CUERV-R-T', name: 'Jose Cuervo Reposado - Trago', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-CUERV-R-SV', name: 'Jose Cuervo Reposado - Servicio', price: 60, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-JAGER-S', name: 'Jägermeister - Shot', price: 6, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-JAGER-T', name: 'Jägermeister - Trago', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-JAGER-SV', name: 'Jägermeister - Servicio', price: 45, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-ESP-DESCOR', name: 'Descorche Tequila/Jäger', price: 22.5, serviceCategory: 'SERVICE' },
            ],
        },
        // VINOS Y ESPUMANTES
        {
            name: 'VINOS Y ESPUMANTES',
            sortOrder: 140,
            items: [
                { sku: 'TP-VINO-LINDA-C', name: 'Vino Linda Mora - Copa', price: 6, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-LINDA-S', name: 'Vino Linda Mora - Servicio', price: 30, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-BENJ-C', name: 'Benjamin Malbec - Copa', price: 6, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-BENJ-S', name: 'Benjamin Malbec - Servicio', price: 40, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-PINOT-C', name: 'Pinot Grigio - Copa', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-PINOT-S', name: 'Pinot Grigio - Servicio', price: 37.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-MAX-C', name: 'Maximilian I Prosecco - Copa', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-MAX-S', name: 'Maximilian I Prosecco - Servicio', price: 37.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-VINO-DESCOR', name: 'Descorche de Vino', price: 15, serviceCategory: 'SERVICE' },
            ],
        },
        // CÓCTELES
        {
            name: 'CÓCTELES',
            sortOrder: 150,
            items: [
                { sku: 'TP-COC-TINTO', name: 'Tinto de Verano', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-MOJITO', name: 'Mojito', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-JAGER-M', name: 'Jäger Mojito', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-DAIQ', name: 'Daiquirí', price: 9, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-GIN-T', name: 'Gin Tonic', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-NEGRONI', name: 'Negroni', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-CLOVER', name: 'Clover Club', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-MOSCOW', name: 'Moscow Mule', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-MARG', name: 'Margarita', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-BERLIN', name: 'Berlin Mule', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-ORGASMO', name: 'Orgasmo', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-KAIP', name: 'Kaipiroska', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-COSMO', name: 'Cosmopolitan', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-PALOMA', name: 'Paloma', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-PINA', name: 'Piña Colada', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-COC-APEROL', name: 'Aperol Spritz', price: 12, serviceCategory: 'COCKTAIL' },
            ],
        },
        // DIGESTIVOS
        {
            name: 'DIGESTIVOS',
            sortOrder: 160,
            items: [
                { sku: 'TP-DIG-SAMB', name: 'Sambuca', price: 6, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-DIG-AMAR', name: 'Amaretto', price: 7.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-DIG-DAISAR', name: 'Daisaronno Sawer', price: 10.5, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-DIG-EXP-M', name: 'Expresso Martini', price: 12, serviceCategory: 'COCKTAIL' },
                { sku: 'TP-DIG-LIMON', name: 'Limoncello', price: 12, serviceCategory: 'COCKTAIL' },
            ],
        },
        // COVER Y ALQUILER
        {
            name: 'COVER Y ALQUILER',
            sortOrder: 170,
            items: [
                { sku: 'TP-COVER-DJ', name: 'Cover Dom-Jue', price: 7.5, serviceCategory: 'SERVICE' },
                { sku: 'TP-COVER-VS', name: 'Cover Vier-Sáb', price: 9, serviceCategory: 'SERVICE' },
                { sku: 'TP-ALQ-RAQ', name: 'Raqueta Profesional Ping Pong (1h)', price: 7.5, serviceCategory: 'GAME' },
                { sku: 'TP-ALQ-ROBOT', name: 'Robot Tenis de Mesa (30min)', price: 12, serviceCategory: 'GAME' },
                { sku: 'TP-ALQ-ENSAMB', name: 'Ensamblaje Raqueta (2 gomas + pala)', price: 15, serviceCategory: 'SERVICE' },
            ],
        },
        // EVENTOS PRIVADOS
        {
            name: 'EVENTOS PRIVADOS',
            sortOrder: 180,
            items: [
                { sku: 'TP-EV-MITAD-ARRIBA', name: 'Mitad Piso Arriba - Hora', price: 75, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-MITAD-ARRIBA-VS', name: 'Mitad Piso Arriba - Hora (Vie-Sáb 7PM-2AM)', price: 112.5, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-PISO-ARRIBA', name: 'Piso Arriba - Hora', price: 150, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-PISO-ARRIBA-VS', name: 'Piso Arriba - Hora (Vie-Sáb 7PM-2AM)', price: 225, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-MITAD-ABAJO', name: 'Mitad Piso Abajo - Hora', price: 75, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-MITAD-ABAJO-VS', name: 'Mitad Piso Abajo - Hora (Vie-Sáb 7PM-2AM)', price: 112.5, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-PISO-ABAJO', name: 'Piso Abajo - Hora', price: 150, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-PISO-ABAJO-VS', name: 'Piso Abajo - Hora (Vie-Sáb 7PM-2AM)', price: 225, serviceCategory: 'SERVICE' },
                { sku: 'TP-EV-LOCAL', name: 'Local Completo - Hora', price: 600, serviceCategory: 'SERVICE' },
            ],
        },
        // MEMBRESÍA
        {
            name: 'MEMBRESÍAS',
            sortOrder: 190,
            items: [
                { sku: 'TP-MEMB-MENSUAL', name: 'Membresía Mensual Table Pong', price: 150, serviceCategory: 'SERVICE' },
            ],
        },
        // ALQUILER EVENTOS FUERA
        {
            name: 'ALQUILER EVENTOS FUERA',
            sortOrder: 200,
            items: [
                { sku: 'TP-ALQ-DOMINO', name: 'Mesa Domino + 4 Sillas', price: 112.5, serviceCategory: 'SERVICE' },
                { sku: 'TP-ALQ-BEERPONG', name: 'Mesa Beer Pong + 20 Vasos + 2 Pelotas', price: 112.5, serviceCategory: 'SERVICE' },
                { sku: 'TP-ALQ-TENIS', name: 'Cancha Tenis Mesa + 4 Raquetas + 4 Pelotas', price: 150, serviceCategory: 'SERVICE' },
                { sku: 'TP-ALQ-FUTBOL', name: 'Mesa Futbolito + 1 Pelota', price: 150, serviceCategory: 'SERVICE' },
                { sku: 'TP-ALQ-CAMP', name: 'Cancha Tenis Mesa Campeonato', price: 375, serviceCategory: 'SERVICE' },
                { sku: 'TP-ALQ-PAQ', name: 'Paquete Especial (1 Tenis 1 Beer Pong 1 Futbolito 2 Domino)', price: 525, serviceCategory: 'SERVICE' },
            ],
        },
        // LALIGA TABLEPONG
        {
            name: 'EVENTOS LALIGA',
            sortOrder: 210,
            items: [
                { sku: 'TP-LALIGA-INSCR', name: 'Inscripción Laliga Table Pong (por atleta)', price: 10, serviceCategory: 'SERVICE' },
            ],
        },
        // STORE - MESAS
        {
            name: 'STORE - MESAS',
            sortOrder: 220,
            items: [
                { sku: 'TP-STORE-MESA-CAMP', name: 'Mesa Campeonato Profesional DHS Golden Rainbow (25mm ITFF)', price: 4500, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-MESA-PRO', name: 'Mesa Profesional DHS (25mm ITFF)', price: 2250, serviceCategory: 'SERVICE' },
            ],
        },
        // STORE - PELOTAS
        {
            name: 'STORE - PELOTAS',
            sortOrder: 230,
            items: [
                { sku: 'TP-STORE-PEL-1E-10', name: 'Pelotas DHS 1 Estrella - Paq. 10 und', price: 9, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-PEL-1E-120', name: 'Pelotas DHS 1 Estrella - Paq. 120 und', price: 105, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-PEL-3E-10', name: 'Pelotas DHS 3 Estrellas - Paq. 10 und', price: 15, serviceCategory: 'SERVICE' },
            ],
        },
        // STORE - ACCESORIOS
        {
            name: 'STORE - ACCESORIOS',
            sortOrder: 240,
            items: [
                { sku: 'TP-STORE-MARCADOR', name: 'Marcador de Puntos DHS', price: 75, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-POSTE-MALLA', name: 'Poste de Malla + Malla DHS', price: 60, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-MALLA', name: 'Malla DHS', price: 30, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-BOLSO-DHS', name: 'Bolso DHS', price: 45, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-BOLSO-STIGA', name: 'Bolso STIGA', price: 60, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-ESPONJA', name: 'Esponja para Limpiar Gomas DHS', price: 7.5, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-ATTACH-GLUE', name: 'Attach Power Glue', price: 45, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-BOND-GLUE', name: 'Bond Glue STIGA', price: 45, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-RECOGEPELOTAS', name: 'Recoge Pelotas STIGA', price: 45, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-TOALLA', name: 'Toalla STIGA', price: 45, serviceCategory: 'SERVICE' },
            ],
        },
        // STORE - MANGOS
        {
            name: 'STORE - MANGOS',
            sortOrder: 250,
            items: [
                { sku: 'TP-STORE-MANGO-CYBER', name: 'STIGA Cybershape Wood', price: 210, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-MANGO-PRIMORAC', name: 'Butterfly Primorac', price: 150, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-MANGO-KORBEL', name: 'Butterfly Petr Korbel', price: 135, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-MANGO-PG12', name: 'PG12-L DHS FL', price: 60, serviceCategory: 'SERVICE' },
            ],
        },
        // STORE - GOMAS
        {
            name: 'STORE - GOMAS',
            sortOrder: 260,
            items: [
                { sku: 'TP-STORE-GOMA-DIGNICS', name: 'Butterfly Dignics 05', price: 180, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-GOMA-DRAGON', name: 'STIGA Dragon Power', price: 120, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-GOMA-ROZENA', name: 'Butterfly Rozena', price: 90, serviceCategory: 'SERVICE' },
                { sku: 'TP-STORE-GOMA-NH3', name: 'DHS Hurricane 3 (NH3) 2.2mm', price: 45, serviceCategory: 'SERVICE' },
            ],
        },
    ];

    for (const cat of categories) {
        const category = await prisma.menuCategory.upsert({
            where: { id: `cat-${cat.sortOrder}` },
            update: { name: cat.name, sortOrder: cat.sortOrder },
            create: {
                id: `cat-${cat.sortOrder}`,
                name: cat.name,
                sortOrder: cat.sortOrder,
            },
        });

        for (const item of cat.items) {
            await prisma.menuItem.upsert({
                where: { sku: item.sku },
                update: {
                    name: item.name,
                    price: item.price,
                    serviceCategory: item.serviceCategory || null,
                },
                create: {
                    sku: item.sku,
                    name: item.name,
                    categoryId: category.id,
                    price: item.price,
                    serviceCategory: item.serviceCategory || null,
                    kitchenRouting: item.serviceCategory === 'FOOD' ? 'KITCHEN' : item.serviceCategory === 'COCKTAIL' ? 'BAR' : 'NONE',
                },
            });
        }
    }

    // 4. Modificador Michelada (+$1)
    const modGroup = await prisma.menuModifierGroup.upsert({
        where: { id: 'mod-michelada' },
        update: {},
        create: {
            id: 'mod-michelada',
            name: 'Michelada',
            description: 'Adicional a cerveza',
            isRequired: false,
            minSelections: 0,
            maxSelections: 1,
        },
    });
    await prisma.menuModifier.upsert({
        where: { id: 'mod-michelada-1' },
        update: {},
        create: {
            id: 'mod-michelada-1',
            groupId: modGroup.id,
            name: 'Michelada',
            priceAdjustment: 1,
        },
    });

    // Vincular Michelada a cervezas individuales
    const cervezas = await prisma.menuItem.findMany({
        where: { category: { name: 'CERVEZAS' }, sku: { not: 'TP-CERV-TOBO' } },
    });
    for (const c of cervezas) {
        const existing = await prisma.menuItemModifierGroup.findFirst({
            where: { menuItemId: c.id, modifierGroupId: modGroup.id },
        });
        if (!existing) {
            await prisma.menuItemModifierGroup.create({
                data: { menuItemId: c.id, modifierGroupId: modGroup.id },
            });
        }
    }

    console.log('✅ Menús y artículos creados');

    // Tasa de cambio BCV (1 USD = 433.16 Bs, Fecha Valor: Lunes 9 Marzo 2026)
    const mondayMarch9 = new Date('2026-03-09T12:00:00.000Z');
    await prisma.exchangeRate.upsert({
        where: { id: 'seed-rate-bcv-2026' },
        update: { rate: 433.16, effectiveDate: mondayMarch9 },
        create: {
            id: 'seed-rate-bcv-2026',
            rate: 433.16,
            effectiveDate: mondayMarch9,
            source: 'BCV',
        },
    });
    console.log('✅ Tasa de cambio BCV configurada (1 USD = 433.16 Bs)');

    console.log('🎉 Seed Table Pong completado!');
    console.log('   Login: admin@tablepong.com / tablepong123');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
