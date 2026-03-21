import { getPartnersAction, getMenuItemsWithPartnerAction } from '@/app/actions/intercompany.actions';
import IntercompanyView from './intercompany-view';

export default async function IntercompanyPage() {
    const [partnersResult, itemsResult] = await Promise.all([
        getPartnersAction(),
        getMenuItemsWithPartnerAction(),
    ]);

    return (
        <IntercompanyView
            partners={partnersResult.data || []}
            menuItems={itemsResult.data || []}
        />
    );
}
