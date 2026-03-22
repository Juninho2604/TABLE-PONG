import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import prisma from '@/server/db';
import CycleSnapshotDetail from './cycle-detail';

const ROLES = ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'AUDITOR', 'AREA_LEAD'];

export default async function CicloDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) redirect('/login');
    if (!ROLES.includes(session.role)) redirect('/dashboard');

    const { id } = await params;

    const cycle = await prisma.inventoryCycle.findUnique({
        where: { id },
        include: {
            createdBy: { select: { firstName: true, lastName: true } },
            closedBy: { select: { firstName: true, lastName: true } },
        },
    });

    if (!cycle) {
        return (
            <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300">Ciclo no encontrado.</p>
                <Link href="/dashboard/inventario/ciclos" className="text-teal-600 hover:underline dark:text-teal-400">
                    ← Volver a ciclos
                </Link>
            </div>
        );
    }

    return (
        <CycleSnapshotDetail
            cycle={{
                ...cycle,
                periodStart: cycle.periodStart,
                periodEnd: cycle.periodEnd,
                closedAt: cycle.closedAt,
            }}
        />
    );
}
