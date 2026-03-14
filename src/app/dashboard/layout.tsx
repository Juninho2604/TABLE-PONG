import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { getSession } from '@/lib/auth';
import { prisma } from '@/server/db';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    // Fetch allowedModules from DB for sidebar filtering
    let allowedModules: string[] | null = null;
    if (session?.id) {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.id },
            select: { allowedModules: true },
        });
        if (dbUser?.allowedModules) {
            try { allowedModules = JSON.parse(dbUser.allowedModules); } catch { /* ignore */ }
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Sidebar con usuario real */}
            <Sidebar initialUser={session} allowedModules={allowedModules} />

            {/* Main content area */}
            <div className="md:pl-64">
                {/* Navbar */}
                <Navbar />

                {/* Page content */}
                <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
