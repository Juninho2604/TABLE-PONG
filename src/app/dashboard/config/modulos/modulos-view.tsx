'use client';

import { useState, useTransition } from 'react';
import { updateUserModulesAction } from '@/app/actions/user.actions';

// Lista maestra de módulos disponibles (matches Sidebar hrefs)
const ALL_MODULES = [
    // Operaciones
    { href: '/dashboard', label: 'Dashboard', group: 'Operaciones' },
    { href: '/dashboard/inventario/diario', label: 'Inventario Diario', group: 'Operaciones' },
    { href: '/dashboard/inventario', label: 'Inventario', group: 'Operaciones' },
    { href: '/dashboard/inventario/auditorias', label: 'Auditorías', group: 'Operaciones' },
    { href: '/dashboard/transferencias', label: 'Transferencias', group: 'Operaciones' },
    { href: '/dashboard/inventario/historial-mensual', label: 'Historial Mensual', group: 'Operaciones' },
    { href: '/dashboard/prestamos', label: 'Préstamos', group: 'Operaciones' },
    { href: '/dashboard/recetas', label: 'Recetas', group: 'Operaciones' },
    { href: '/dashboard/produccion', label: 'Producción', group: 'Operaciones' },
    { href: '/dashboard/costos', label: 'Costos', group: 'Operaciones' },
    { href: '/dashboard/compras', label: 'Compras', group: 'Operaciones' },
    { href: '/dashboard/menu', label: 'Menú', group: 'Operaciones' },
    // Ventas / POS
    { href: '/dashboard/pos/sportbar', label: 'POS Sport Bar', group: 'Ventas' },
    { href: '/dashboard/pos/restaurante', label: 'POS Pick Up', group: 'Ventas' },
    { href: '/dashboard/pos/delivery', label: 'POS Delivery', group: 'Ventas' },
    { href: '/dashboard/ventas/cargar', label: 'Cargar Ventas', group: 'Ventas' },
    { href: '/dashboard/sales', label: 'Historial Ventas', group: 'Ventas' },
    { href: '/kitchen', label: 'Comandera Cocina', group: 'Ventas' },
    // Administración
    { href: '/dashboard/usuarios', label: 'Usuarios', group: 'Administración' },
    { href: '/dashboard/config/roles', label: 'Roles y Permisos', group: 'Administración' },
    { href: '/dashboard/almacenes', label: 'Almacenes', group: 'Administración' },
    { href: '/dashboard/config/tasa-cambio', label: 'Tasa de Cambio', group: 'Administración' },
    { href: '/dashboard/config/modulos', label: 'Módulos por Usuario', group: 'Administración' },
];

const GROUPS = ['Operaciones', 'Ventas', 'Administración'];

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    allowedModules: string | null;
}

interface Props {
    users: User[];
}

export function ModulosView({ users }: Props) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selected, setSelected] = useState<string[] | null>(null); // null = usa rol
    const [useRole, setUseRole] = useState(true);
    const [saving, startSave] = useTransition();
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    function openUser(user: User) {
        setSelectedUser(user);
        setMessage(null);
        if (user.allowedModules === null) {
            setUseRole(true);
            setSelected(null);
        } else {
            try {
                const parsed: string[] = JSON.parse(user.allowedModules);
                setUseRole(false);
                setSelected(parsed);
            } catch {
                setUseRole(true);
                setSelected(null);
            }
        }
    }

    function toggleModule(href: string) {
        setSelected(prev => {
            const cur = prev ?? [];
            return cur.includes(href) ? cur.filter(h => h !== href) : [...cur, href];
        });
    }

    function toggleGroup(group: string) {
        const groupHrefs = ALL_MODULES.filter(m => m.group === group).map(m => m.href);
        setSelected(prev => {
            const cur = prev ?? [];
            const allOn = groupHrefs.every(h => cur.includes(h));
            if (allOn) return cur.filter(h => !groupHrefs.includes(h));
            const next = new Set([...cur, ...groupHrefs]);
            return Array.from(next);
        });
    }

    function handleSave() {
        if (!selectedUser) return;
        const modules = useRole ? null : (selected ?? []);
        startSave(async () => {
            const res = await updateUserModulesAction(selectedUser.id, modules);
            setMessage({ type: res.success ? 'ok' : 'err', text: res.message });
            if (res.success) {
                // Update local user list
                setSelectedUser(prev => prev ? { ...prev, allowedModules: modules === null ? null : JSON.stringify(modules) } : null);
            }
        });
    }

    const activeUsers = users.filter(u => u.isActive);
    const inactiveUsers = users.filter(u => !u.isActive);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Módulos por Usuario</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Selecciona un usuario para configurar qué módulos del sistema puede ver en su menú.
                    Si usas <strong>acceso por rol</strong>, el sistema aplica las reglas predeterminadas del rol.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Lista de usuarios */}
                <div className="lg:col-span-1">
                    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Usuarios Activos ({activeUsers.length})</h2>
                        </div>
                        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                            {activeUsers.map(user => (
                                <li key={user.id}>
                                    <button
                                        onClick={() => openUser(user)}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedUser?.id === user.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                    >
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {user.firstName} {user.lastName}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                {user.role}
                                            </span>
                                            {user.allowedModules !== null && (
                                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    personalizado
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                            {inactiveUsers.length > 0 && (
                                <>
                                    <li className="px-4 py-2 bg-gray-50 dark:bg-gray-900">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inactivos</p>
                                    </li>
                                    {inactiveUsers.map(user => (
                                        <li key={user.id}>
                                            <button
                                                onClick={() => openUser(user)}
                                                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors opacity-50 ${selectedUser?.id === user.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            >
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {user.firstName} {user.lastName}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                            </button>
                                        </li>
                                    ))}
                                </>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Panel de módulos */}
                <div className="lg:col-span-2">
                    {!selectedUser ? (
                        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <p className="text-gray-400">Selecciona un usuario de la lista</p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            {/* Header */}
                            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selectedUser.firstName} {selectedUser.lastName}
                                </h2>
                                <p className="text-sm text-gray-500">{selectedUser.email} · {selectedUser.role}</p>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Toggle: usar rol vs personalizado */}
                                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={useRole}
                                            onChange={() => { setUseRole(true); setSelected(null); }}
                                            className="accent-blue-600"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Acceso por rol ({selectedUser.role})</p>
                                            <p className="text-xs text-gray-500">El sistema usa las reglas predeterminadas del rol</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer ml-6">
                                        <input
                                            type="radio"
                                            checked={!useRole}
                                            onChange={() => {
                                                setUseRole(false);
                                                if (selected === null) setSelected([]);
                                            }}
                                            className="accent-blue-600"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Módulos personalizados</p>
                                            <p className="text-xs text-gray-500">Elige exactamente qué ve este usuario</p>
                                        </div>
                                    </label>
                                </div>

                                {/* Selector de módulos */}
                                {!useRole && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {(selected ?? []).length} módulos seleccionados
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelected(ALL_MODULES.map(m => m.href))}
                                                    className="text-xs text-blue-600 hover:underline"
                                                >
                                                    Todos
                                                </button>
                                                <span className="text-gray-300">·</span>
                                                <button
                                                    onClick={() => setSelected([])}
                                                    className="text-xs text-blue-600 hover:underline"
                                                >
                                                    Ninguno
                                                </button>
                                            </div>
                                        </div>

                                        {GROUPS.map(group => {
                                            const groupModules = ALL_MODULES.filter(m => m.group === group);
                                            const cur = selected ?? [];
                                            const allGroupOn = groupModules.every(m => cur.includes(m.href));
                                            const someGroupOn = groupModules.some(m => cur.includes(m.href));

                                            return (
                                                <div key={group} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                    {/* Group header */}
                                                    <button
                                                        onClick={() => toggleGroup(group)}
                                                        className="flex w-full items-center justify-between bg-gray-50 dark:bg-gray-900/50 px-4 py-2 text-left"
                                                    >
                                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{group}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${allGroupOn ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : someGroupOn ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-500'}`}>
                                                            {allGroupOn ? 'todos' : someGroupOn ? 'parcial' : 'ninguno'}
                                                        </span>
                                                    </button>
                                                    {/* Modules */}
                                                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {groupModules.map(mod => {
                                                            const on = cur.includes(mod.href);
                                                            return (
                                                                <label key={mod.href} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={on}
                                                                        onChange={() => toggleModule(mod.href)}
                                                                        className="accent-blue-600 h-4 w-4"
                                                                    />
                                                                    <span className="text-sm text-gray-800 dark:text-gray-200">{mod.label}</span>
                                                                    <span className="ml-auto text-xs text-gray-400 font-mono">{mod.href}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Message */}
                                {message && (
                                    <div className={`rounded-lg px-4 py-3 text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                                        {message.text}
                                    </div>
                                )}

                                {/* Save */}
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar cambios'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}