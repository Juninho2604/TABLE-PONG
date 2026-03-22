/** Tipos de ítem de inventario (Prisma InventoryItem.type) */
export const INVENTORY_TYPE_OPTIONS = [
    { value: 'RAW_MATERIAL', label: 'Materia prima', emoji: '📦', hint: 'Compras, insumos' },
    { value: 'SUB_RECIPE', label: 'Sub-receta / compuesto', emoji: '🧀', hint: 'Prep, mezclas' },
    { value: 'FINISHED_GOOD', label: 'Producto final', emoji: '🍽️', hint: 'Plato, bebida lista' },
] as const;

/** Rol operativo para filtros y reportes (InventoryItem.productRole) */
export const PRODUCT_ROLE_OPTIONS = [
    { value: 'RAW', label: 'Insumo base', emoji: '📦' },
    { value: 'INTERMEDIATE', label: 'Intermedio', emoji: '⚗️' },
    { value: 'COMPOUND', label: 'Compuesto', emoji: '🧩' },
    { value: 'FINISHED', label: 'Final venta', emoji: '✅' },
    { value: 'TRANSFORMABLE', label: 'Se transforma', emoji: '🔀' },
] as const;

export const BASE_UNIT_OPTIONS = ['KG', 'G', 'L', 'ML', 'UNIT', 'PORTION'] as const;

export const STOCK_TRACKING_OPTIONS = [
    { value: 'UNIT', label: 'Por unidad' },
    { value: 'RECIPE', label: 'Receta' },
    { value: 'COMPOUND', label: 'Compuesto' },
    { value: 'DISPLAY_ONLY', label: 'Solo display' },
] as const;

export type InventoryTypeValue = (typeof INVENTORY_TYPE_OPTIONS)[number]['value'];
