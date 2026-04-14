'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ============================================================================
// TIPOS
// ============================================================================

export type DocType =
    | 'CEDULA_V'   // Cédula venezolana (V-12345678)
    | 'CEDULA_E'   // Cédula extranjero (E-87654321)
    | 'RIF_J'      // RIF empresa (J-123456789)
    | 'RIF_V'      // RIF persona natural (V-12345678-0)
    | 'RIF_G'      // RIF gobierno / entidad pública (G-20000001-0)
    | 'RIF_C'      // RIF cooperativa (C-...)
    | 'RIF_E'      // RIF extranjero (E-...)
    | 'PASAPORTE'; // Pasaporte (formato libre)

export interface CustomerRecord {
    id: string;
    name: string;
    docType: DocType | null;
    docNumber: string | null;  // Número limpio sin prefijo de tipo
    phone: string | null;
    email: string | null;
    notes: string | null;
    isActive: boolean;
    visitCount: number;
    totalSpent: number;
    lastVisitAt: Date | null;
}

// Prefijos para mostrar en UI
export const DOC_TYPE_LABELS: Record<DocType, string> = {
    CEDULA_V:  'V-',
    CEDULA_E:  'E-',
    RIF_J:     'J-',
    RIF_V:     'V-',
    RIF_G:     'G-',
    RIF_C:     'C-',
    RIF_E:     'E-',
    PASAPORTE: 'PAS-',
};

export const DOC_TYPE_DISPLAY: Record<DocType, string> = {
    CEDULA_V:  'Cédula V',
    CEDULA_E:  'Cédula E',
    RIF_J:     'RIF J',
    RIF_V:     'RIF V',
    RIF_G:     'RIF G',
    RIF_C:     'RIF C',
    RIF_E:     'RIF E',
    PASAPORTE: 'Pasaporte',
};

/** Devuelve el documento formateado para mostrar: "V-12345678" */
export function formatDocId(docType: DocType | null, docNumber: string | null): string {
    if (!docType || !docNumber) return '';
    return `${DOC_TYPE_LABELS[docType]}${docNumber}`;
}

// ─── Campos a seleccionar en todas las consultas ─────────────────────────────
const CUSTOMER_SELECT = {
    id: true,
    name: true,
    docType: true,
    docNumber: true,
    phone: true,
    email: true,
    notes: true,
    isActive: true,
    visitCount: true,
    totalSpent: true,
    lastVisitAt: true,
} as const;

// ============================================================================
// BUSCAR CLIENTES
// ============================================================================
export async function searchCustomersAction(query: string): Promise<{
    success: boolean;
    data?: CustomerRecord[];
    message?: string;
}> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const q = query.trim();

    if (!q) {
        // Sin query: top 10 más frecuentes
        const customers = await prisma.customer.findMany({
            where: { isActive: true },
            orderBy: [{ visitCount: 'desc' }, { lastVisitAt: 'desc' }],
            take: 10,
            select: CUSTOMER_SELECT,
        });
        return { success: true, data: customers as CustomerRecord[] };
    }

    // Determinar si el query parece un número de documento (solo dígitos, quizá con guión)
    const isDocQuery = /^[\d\-]+$/.test(q);

    const customers = await prisma.customer.findMany({
        where: {
            isActive: true,
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { docNumber: { contains: q.replace(/-/g, ''), mode: 'insensitive' } },
                { phone: { contains: q } },
                ...(isDocQuery ? [] : [{ email: { contains: q, mode: 'insensitive' as const } }]),
            ],
        },
        orderBy: [{ visitCount: 'desc' }, { name: 'asc' }],
        take: 10,
        select: CUSTOMER_SELECT,
    });

    return { success: true, data: customers as CustomerRecord[] };
}

// ============================================================================
// CREAR CLIENTE
// ============================================================================
export async function createCustomerAction(data: {
    name: string;
    docType?: DocType | null;
    docNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
}): Promise<{ success: boolean; data?: CustomerRecord; message?: string }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const name = data.name.trim();
    if (!name) return { success: false, message: 'El nombre es obligatorio' };

    const docNumber = data.docNumber?.trim().replace(/\D/g, '') || null;
    const docType = data.docType || null;

    // Deduplicar por número de documento si se proporcionó
    if (docNumber && docType) {
        const existing = await prisma.customer.findUnique({ where: { docNumber }, select: CUSTOMER_SELECT });
        if (existing) {
            return {
                success: true,
                data: existing as CustomerRecord,
                message: 'Cliente ya registrado con ese documento',
            };
        }
    }

    const customer = await prisma.customer.create({
        data: {
            name,
            docType:   docType   ?? undefined,
            docNumber: docNumber ?? undefined,
            phone:     data.phone?.trim()  || undefined,
            email:     data.email?.trim()  || undefined,
            notes:     data.notes?.trim()  || undefined,
        },
        select: CUSTOMER_SELECT,
    });

    revalidatePath('/dashboard/pos/restaurante');
    revalidatePath('/dashboard/pos/delivery');
    revalidatePath('/dashboard/pos/sportbar');
    return { success: true, data: customer as CustomerRecord };
}

// ============================================================================
// ACTUALIZAR DATOS DEL CLIENTE
// ============================================================================
export async function updateCustomerAction(
    id: string,
    data: {
        name?: string;
        docType?: DocType | null;
        docNumber?: string | null;
        phone?: string | null;
        email?: string | null;
        notes?: string | null;
    }
): Promise<{ success: boolean; data?: CustomerRecord; message?: string }> {
    const session = await getSession();
    if (!session) return { success: false, message: 'No autorizado' };

    const docNumber = data.docNumber !== undefined
        ? (data.docNumber?.trim().replace(/\D/g, '') || null)
        : undefined;

    // Comprobar unicidad de docNumber si cambia
    if (docNumber) {
        const conflict = await prisma.customer.findUnique({ where: { docNumber } });
        if (conflict && conflict.id !== id) {
            return { success: false, message: 'Ese número de documento ya pertenece a otro cliente' };
        }
    }

    const customer = await prisma.customer.update({
        where: { id },
        data: {
            ...(data.name      !== undefined ? { name:      data.name.trim() }         : {}),
            ...(data.docType   !== undefined ? { docType:   data.docType ?? null }      : {}),
            ...(docNumber      !== undefined ? { docNumber: docNumber ?? null }          : {}),
            ...(data.phone     !== undefined ? { phone:     data.phone?.trim() || null } : {}),
            ...(data.email     !== undefined ? { email:     data.email?.trim() || null } : {}),
            ...(data.notes     !== undefined ? { notes:     data.notes?.trim() || null } : {}),
        },
        select: CUSTOMER_SELECT,
    });

    return { success: true, data: customer as CustomerRecord };
}

// ============================================================================
// REGISTRAR VISITA  (incrementar al cobrar)
// ============================================================================
export async function recordCustomerVisitAction(
    customerId: string,
    amountSpent?: number
): Promise<void> {
    await prisma.customer.update({
        where: { id: customerId },
        data: {
            visitCount:  { increment: 1 },
            lastVisitAt: new Date(),
            ...(amountSpent ? { totalSpent: { increment: amountSpent } } : {}),
        },
    });
}
