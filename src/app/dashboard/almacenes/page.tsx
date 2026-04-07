import { getAreasForConfig } from '@/app/actions/area.actions';
import AlmacenesView from './almacenes-view';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTenantFullName } from '@/config/branding';

export const metadata = {
    title: `Almacenes | ${getTenantFullName()} ERP`,
    description: 'Gestión de almacenes y áreas',
};

export const dynamic = 'force-dynamic';

export default async function AlmacenesPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    let areas: { id: string; name: string; description: string | null; isActive: boolean }[] = [];
    try {
        areas = await getAreasForConfig();
    } catch {
        // Sin permisos
    }

    return <AlmacenesView initialAreas={areas} />;
}
