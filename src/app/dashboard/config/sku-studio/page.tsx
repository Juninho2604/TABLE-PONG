import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listProductFamiliesAction, listSkuTemplatesAction } from '@/app/actions/sku-studio.actions';
import SkuStudioView from './sku-studio-view';

const ADMIN_EMAIL = 'admin@tablepong.com';

export default async function SkuStudioPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const ok = session.role === 'OWNER' || session.email?.toLowerCase() === ADMIN_EMAIL;
    if (!ok) redirect('/dashboard');

    const [famRes, tplRes] = await Promise.all([listProductFamiliesAction(), listSkuTemplatesAction()]);

    const initialFamilies = famRes.success && famRes.data ? famRes.data : [];
    const initialTemplates = tplRes.success && tplRes.data ? tplRes.data : [];

    return <SkuStudioView initialFamilies={initialFamilies as any} initialTemplates={initialTemplates as any} />;
}
