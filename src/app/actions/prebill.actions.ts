'use server';

import prisma from '@/server/db';
import { getSession } from '@/lib/auth';

export async function incrementPreBillPrintAction(openTabId: string): Promise<{
    success: boolean;
    count: number;
    tableName?: string;
}> {
    const session = await getSession();
    if (!session) return { success: false, count: 0 };

    const tab = await prisma.openTab.update({
        where: { id: openTabId },
        data: { preBillPrintCount: { increment: 1 } },
        select: {
            preBillPrintCount: true,
            tableOrStation: { select: { name: true } },
        },
    });

    return {
        success: true,
        count: tab.preBillPrintCount,
        tableName: tab.tableOrStation?.name,
    };
}
