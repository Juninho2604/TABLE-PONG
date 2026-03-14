import { getUsersWithModules } from '@/app/actions/user.actions';
import { ModulosView } from './modulos-view';

export default async function ModulosPage() {
    const users = await getUsersWithModules();
    return <ModulosView users={users} />;
}