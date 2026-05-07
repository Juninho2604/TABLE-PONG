// Tipos y helpers de clientes — exportados sin 'use server' para uso en componentes cliente

export type DocType =
    | 'CEDULA_V'
    | 'CEDULA_E'
    | 'RIF_J'
    | 'RIF_V'
    | 'RIF_G'
    | 'RIF_C'
    | 'RIF_E'
    | 'PASAPORTE';

export interface CustomerRecord {
    id: string;
    name: string;
    docType: DocType | null;
    docNumber: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    isActive: boolean;
    visitCount: number;
    totalSpent: number;
    lastVisitAt: Date | null;
}

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

export function formatDocId(docType: DocType | null, docNumber: string | null): string {
    if (!docType || !docNumber) return '';
    return `${DOC_TYPE_LABELS[docType]}${docNumber}`;
}
