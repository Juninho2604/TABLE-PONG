'use server';

// Compatibilidad: puente para ramas/rutas antiguas en español.
// Reexporta las acciones actuales de ventas para evitar bloqueos por diferencias de path.
export * from '@/app/actions/sales.actions';
