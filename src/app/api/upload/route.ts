import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

// La extensión se deriva del tipo validado, nunca del nombre enviado por el cliente
const EXTENSION_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};

// Directorio donde se guardan los uploads
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'notas-entrega');

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const referenceNumber = formData.get('referenceNumber') as string | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No se recibió ningún archivo' },
                { status: 400 }
            );
        }

        // Validar tipo de archivo
        const extension = EXTENSION_BY_TYPE[file.type];
        if (!extension) {
            return NextResponse.json(
                { success: false, error: 'Tipo de archivo no permitido. Use JPG, PNG, WebP o PDF.' },
                { status: 400 }
            );
        }

        // Validar tamaño (máximo 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { success: false, error: 'El archivo excede el tamaño máximo de 5MB' },
                { status: 400 }
            );
        }

        // Crear directorio si no existe
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true });
        }

        // Generar nombre único
        const timestamp = Date.now();
        const sanitizedRef = referenceNumber?.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40) || 'sin-ref';
        const fileName = `nota-${sanitizedRef}-${timestamp}.${extension}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        // Guardar archivo
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        const publicUrl = `/uploads/notas-entrega/${fileName}`;

        console.log('✅ Archivo guardado:', {
            fileName,
            size: file.size,
            path: publicUrl,
        });

        return NextResponse.json({
            success: true,
            message: 'Archivo subido correctamente',
            data: {
                fileName,
                url: publicUrl,
                size: file.size,
                type: file.type,
            },
        });

    } catch (error) {
        console.error('❌ Error al subir archivo:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno al procesar el archivo' },
            { status: 500 }
        );
    }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
