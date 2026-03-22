import { getCaracasDateStamp } from '@/lib/datetime';

/** Roles que ven el recordatorio dominical de inventario general */
export const SUNDAY_INVENTORY_ROLES = new Set([
    'OWNER',
    'ADMIN_MANAGER',
    'OPS_MANAGER',
    'AREA_LEAD',
    'AUDITOR',
]);

export function isCaracasSunday(date = new Date()): boolean {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Caracas',
        weekday: 'short',
    }).formatToParts(date);
    const wd = parts.find(p => p.type === 'weekday')?.value;
    return wd === 'Sun';
}

export function sundayDismissStorageKey(userId: string, date = new Date()): string {
    const day = getCaracasDateStamp(date);
    return `tp-sunday-inv-dismiss-${userId}-${day}`;
}

/** Contenido fijo del flujo dominical (puede complementarse con BroadcastMessage kind=SUNDAY_INVENTORY) */
export const SUNDAY_INVENTORY_GUIDE = {
    title: 'Inventario general — Domingo',
    subtitle: 'Flujo recomendado para gerencia',
    steps: [
        {
            n: 1,
            title: 'Preparación',
            text: 'Revisa que las recetas y unidades de medida estén correctas. Verifica entradas de compras y transferencias pendientes.',
        },
        {
            n: 2,
            title: 'Los 3 almacenes / áreas',
            text: 'Realiza conteo físico en cada ubicación (Barra, Depósito, Plásticos u otras áreas activas). Registra todo en Inventario Diario o en una nueva Auditoría según el procedimiento del local.',
        },
        {
            n: 3,
            title: 'Cierre de ciclo (semanal / quincenal / mensual)',
            text: 'En Inventario → Ciclos de inventario, cierra el periodo actual: el sistema guarda un snapshot histórico del stock por producto y área. Los movimientos y auditorías previas siguen consultables por fecha.',
        },
        {
            n: 4,
            title: 'Detección de fugas',
            text: 'Compara varianzas del inventario diario, mermas y ventas POS. Usa el historial mensual y reportes para trazabilidad.',
        },
    ],
} as const;
