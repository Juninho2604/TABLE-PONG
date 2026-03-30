import { getAreasAction } from '@/app/actions/inventory.actions';
import { getCategoriesAndFamiliesAction } from '@/app/actions/audit.actions';
import { NuevaAuditoriaForm } from './NuevaAuditoriaForm';

export default async function NuevaAuditoriaPage() {
    const [areas, filtersData] = await Promise.all([
        getAreasAction(),
        getCategoriesAndFamiliesAction()
    ]);

    return (
        <div className="max-w-[900px] mx-auto space-y-6">
            <div className="mb-4 print:hidden">
                <a href="/dashboard/inventario/auditorias" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-300">
                    ← Volver a Auditorías
                </a>
            </div>

            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    📋 Nueva Auditoría de Inventario
                </h1>
                <p className="mt-1 text-gray-500">
                    Crea un borrador de auditoría seleccionando qué productos deseas contar
                </p>
            </div>

            <NuevaAuditoriaForm
                areas={areas as any}
                categories={filtersData.categories}
                families={filtersData.families}
            />
        </div>
    );
}
