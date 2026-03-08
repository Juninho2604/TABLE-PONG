import { getExchangeRateForDisplay, getExchangeRateHistory, BCV_URL } from '@/app/actions/exchange.actions';
import { TasaCambioView } from './tasa-cambio-view';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Tasa de Cambio | Table Pong',
    description: 'Configurar tasa USD/Bs según BCV. Los fines de semana se usa la tasa del lunes.',
};

export default async function TasaCambioPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const [current, history] = await Promise.all([
        getExchangeRateForDisplay(),
        getExchangeRateHistory(10),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasa de Cambio USD / Bolívares</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Fuente oficial: <a href={BCV_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Banco Central de Venezuela (BCV)</a>.
                    Los fines de semana se usa la tasa oficial del lunes anterior.
                </p>
            </div>

            <TasaCambioView
                currentRate={current}
                history={history}
                canEdit={session.role === 'OWNER'}
            />
        </div>
    );
}
