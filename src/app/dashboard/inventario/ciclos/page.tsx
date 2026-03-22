import Link from 'next/link';
import InventoryCyclesView from './inventory-cycles-view';

export default function CiclosInventarioPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                    href="/dashboard/inventario"
                    className="text-amber-600 hover:underline dark:text-amber-400"
                >
                    ← Inventario
                </Link>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <Link
                    href="/dashboard/inventario/auditorias"
                    className="text-amber-600 hover:underline dark:text-amber-400"
                >
                    Auditorías
                </Link>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <Link
                    href="/dashboard/inventario/diario"
                    className="text-amber-600 hover:underline dark:text-amber-400"
                >
                    Inventario diario
                </Link>
            </div>
            <InventoryCyclesView />
        </div>
    );
}
