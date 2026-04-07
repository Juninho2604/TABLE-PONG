import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ModulesConfigView } from './modules-config-view';
import { getEnabledModulesFromDB } from '@/app/actions/system-config.actions';
import { getTenantFullName } from '@/config/branding';

export const metadata = {
    title: `Módulos del Sistema | ${getTenantFullName()} ERP`,
    description: 'Activar y desactivar módulos del sistema',
};

export default async function SistemaModulosPage() {
    const session = await getSession();
    if (!session) redirect('/login');
    if (session.role !== 'OWNER') redirect('/dashboard');

    // Leer estado actual desde la BD para inicializar los switches correctamente
    const enabledModuleIds = await getEnabledModulesFromDB();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    🧩 Módulos del Sistema
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Activa o desactiva módulos. Los cambios se guardan en la base de datos
                    y se aplican de inmediato — sin reiniciar el servidor ni editar variables de entorno.
                </p>
            </div>

            <ModulesConfigView initialEnabledIds={enabledModuleIds} />
        </div>
    );
}
