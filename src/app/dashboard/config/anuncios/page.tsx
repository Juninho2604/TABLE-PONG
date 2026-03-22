import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllBroadcastsAdminAction } from '@/app/actions/announcements.actions';
import AnnouncementsAdmin from './announcements-admin';

const ADMIN_EMAIL = 'admin@tablepong.com';

export default async function AnunciosGerenciaPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const ok = session.role === 'OWNER' || session.email?.toLowerCase() === ADMIN_EMAIL;
    if (!ok) redirect('/dashboard');

    const res = await listAllBroadcastsAdminAction();
    const initial = res.success && res.data ? res.data : [];

    return <AnnouncementsAdmin initial={initial as any} />;
}
