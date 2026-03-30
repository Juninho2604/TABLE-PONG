# Documento de Integración: Módulo Shanklish Caracas
**Fecha:** 2026-03-30
**Basado en commits:** `adaedc7` · `0ca57ef` · `f384ff0`
**Rama origen:** `claude/optimize-android-interface-Kp0tw` → `main`

---

## Resumen ejecutivo

Los últimos 3 commits exitosos introdujeron tres grupos de funcionalidades que actualmente están configuradas con referencias al branding de **Table Pong Santa Paula**. Este documento describe punto por punto qué debe ajustarse para que esas mismas funcionalidades operen correctamente bajo el contexto de **Shanklish Caracas**.

---

## Commit 1 — `f384ff0`
### feat: módulo Mesoneros, fix anulaciones y mejoras de factura

**Qué se hizo:**
- Nuevo rol `MESONERO` con acceso restringido (sin cobro, sin finanzas).
- Dashboard `/dashboard/mesoneros` con top de productos y disponibilidad de menú.
- POS Mesero auto-asigna al mesonero logueado como responsable de mesa.
- `getUsersForTabAction` consulta usuarios `MESONERO` reales de la BD.
- Fix: "Anulada por" muestra el usuario de sesión, no el autorizador del PIN.
- Factura: texto más oscuro, sin referencias a dominio externo.

---

### Acciones de integración requeridas para Shanklish

#### 1.1 · Dashboard Mesoneros — branding hardcodeado
**Archivo:** `src/app/dashboard/mesoneros/page.tsx` · línea 51

```diff
-  Turno activo · Table Pong Santa Paula
+  Turno activo · Shanklish Caracas
```

**Por qué:** El mensaje de bienvenida muestra la ubicación del restaurante; debe reflejar el local correcto para los mesoneros de Shanklish.

---

#### 1.2 · Header del POS Mesero — subtítulo de modo
**Archivo:** `src/app/dashboard/pos/mesero/page.tsx` · línea 423

El subtítulo `"Solo toma de pedidos · Sin acceso a cobro"` es genérico y está bien. Sin embargo, si Shanklish necesita identificar el turno por local (ej. mostrando "Shanklish Caracas" en la cabecera), agregar la referencia al lado del título:

```diff
-  POS <span className="text-emerald-400 italic">MESERO</span>
+  POS <span className="text-emerald-400 italic">MESERO</span>
+  <span className="text-xs text-muted-foreground ml-2">· Shanklish Caracas</span>
```

---

#### 1.3 · Acción de mesoneros — filtro de datos por sucursal
**Archivo:** `src/app/actions/mesonero.actions.ts`

Si el sistema ERP sirve a múltiples locales (Table Pong + Shanklish), las consultas de `getMesoneroTopItemsAction` y `getMesoneroMenuAvailabilityAction` deben filtrarse por `locationId` o `restaurantId`.

**Pasos:**
1. Verificar si el modelo `SalesOrder` en Prisma tiene un campo de sucursal/local.
2. Si existe, agregar `where: { locationId: SHANKLISH_LOCATION_ID }` en ambas queries.
3. Si no existe, crear la relación en el schema y migrar antes de proceder.

---

#### 1.4 · Permisos del rol MESONERO para Shanklish
**Archivo:** `src/lib/constants/roles.ts` · línea 270

El rol `MESONERO` actualmente solo tiene acceso a `POS_RESTAURANT`. Si el módulo de Shanklish tiene un POS propio (ej. `POS_SHANKLISH`), añadir el permiso correspondiente:

```typescript
[UserRole.MESONERO]: {
  [SystemModule.POS_RESTAURANT]: ['view', 'create'],
  // Agregar si existe módulo POS Shanklish:
  // [SystemModule.POS_SHANKLISH]: ['view', 'create'],
},
```

---

#### 1.5 · Navegación Sidebar — visibilidad del módulo Mesoneros
**Archivo:** `src/components/layout/Sidebar.tsx` · líneas 119–122

El item "Mesoneros" ya incluye roles correctos (`OWNER`, `ADMIN_MANAGER`, `OPS_MANAGER`, `MESONERO`). No requiere cambios de roles. Sin embargo, si en el futuro se separan los sidebars por local, este item debe estar presente en la versión Shanklish.

---

## Commit 2 — `0ca57ef`
### fix: módulo Mesoneros visible para OWNER/ADMIN_MANAGER/OPS_MANAGER

**Qué se hizo:**
Corrección de la guardia de roles en `Sidebar.tsx` para que los gerentes y el owner también vean el item "Mesoneros" en el menú lateral (antes solo lo veían los MESONERO).

**Estado para Shanklish:** ✅ Ya aplicado globalmente. No requiere acciones adicionales si se comparte el mismo `Sidebar`. Si se crea un sidebar separado para Shanklish, asegurarse de incluir los mismos roles:

```typescript
roles: ['OWNER', 'ADMIN_MANAGER', 'OPS_MANAGER', 'MESONERO']
```

---

## Commit 3 — `adaedc7`
### fix + perf: optimización interfaz Android gama media-baja

**Qué se hizo:**

| Cambio | Archivo |
|--------|---------|
| Seleccionar mesa ya no redirige al menú si no hay cuenta abierta | `pos/mesero/page.tsx` |
| Botón "Ir al Menú →" aparece solo cuando la cuenta ya está abierta | `pos/mesero/page.tsx` |
| Grid de mesas: 3 columnas en móvil (touch targets ≥ 72px) | `pos/mesero/page.tsx` |
| Bottom nav: `min-h-[64px]` + `safe-area-inset-bottom` para Android | `pos/mesero/page.tsx` |
| `touch-action: manipulation` global (elimina delay 300ms) | `globals.css` |
| `backdrop-blur` desactivado en `< lg` (mejora GPU gama baja) | `globals.css` |
| `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch` | `globals.css` |

---

### Acciones de integración requeridas para Shanklish

#### 3.1 · Aplicar el mismo patrón de navegación al POS de Shanklish
Si Shanklish opera con el **POS Restaurante** (`/dashboard/pos/restaurante/page.tsx`) en lugar del POS Mesero, el mismo bug de navegación puede estar presente allí.

**Archivo a revisar:** `src/app/dashboard/pos/restaurante/page.tsx`
**Buscar:** el handler `onClick` en el grid de mesas (similar a línea 482 del POS Mesero).

**Aplicar la misma lógica:**
```typescript
// ❌ Antes (bug)
onClick={() => {
  setSelectedTableId(table.id);
  if (window.innerWidth < 1024) setMobileTab("menu");
}}

// ✅ Después (correcto)
onClick={() => {
  setSelectedTableId(table.id);
  if (window.innerWidth < 1024 && table.openTabs.length > 0) setMobileTab("menu");
}}
```

Y agregar el botón "Ir al Menú →" en el panel de mesa seleccionada dentro del mismo archivo.

---

#### 3.2 · Grid de mesas en POS Restaurante
**Archivo:** `src/app/dashboard/pos/restaurante/page.tsx`

Cambiar la grilla de mesas para Android:
```diff
- className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-3 gap-3"
+ className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-3"
```

Agregar `min-h-[72px]` y `touch-manipulation` a cada botón de mesa.

---

#### 3.3 · Bottom nav en POS Restaurante
**Archivo:** `src/app/dashboard/pos/restaurante/page.tsx` · líneas 2137–2160

Aplicar los mismos cambios del bottom nav:
- `py-4` en vez de `py-3`
- `min-h-[64px]`
- `text-[10px]` en vez de `text-[9px]`
- `touch-manipulation`
- `style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}` en el `<nav>`
- Icono `text-2xl` en vez de `text-xl`

---

#### 3.4 · Optimizaciones globales — ya aplicadas
Los cambios en `globals.css` son **globales** y ya benefician a todas las páginas incluyendo Shanklish:
- `touch-action: manipulation` ✅
- `overscroll-behavior: contain` ✅
- `backdrop-blur` desactivado en móvil ✅

No se requiere acción adicional para estas.

---

## Checklist consolidado de integración

```
SHANKLISH CARACAS — Integración de funcionalidades (commits adaedc7, 0ca57ef, f384ff0)

Módulo Mesoneros (f384ff0 + 0ca57ef)
  [ ] 1.1  Cambiar "Table Pong Santa Paula" → "Shanklish Caracas" en mesoneros/page.tsx
  [ ] 1.2  Opcional: identificar local en cabecera del POS Mesero
  [ ] 1.3  Filtrar queries getMesoneroTopItems/MenuAvailability por locationId si es multi-local
  [ ] 1.4  Revisar permisos MESONERO si existe un POS Shanklish separado
  [ ] 1.5  Verificar que el item Mesoneros aparezca en el sidebar del local Shanklish

Optimización Android — POS Restaurante (adaedc7)
  [ ] 3.1  Aplicar fix de navegación de mesas en pos/restaurante/page.tsx
  [ ] 3.2  Cambiar grid de mesas a 3 columnas en móvil en pos/restaurante/page.tsx
  [ ] 3.3  Actualizar bottom nav (altura, safe-area, touch-manipulation) en pos/restaurante/page.tsx
  [ ] 3.4  globals.css — ya aplicado globalmente ✅
```

---

## Notas técnicas

- **Multi-local vs single-local:** Si el ERP sirve tanto a Table Pong como a Shanklish desde la misma base de datos, el punto 1.3 (filtro por `locationId`) es crítico para que los reportes de mesoneros no mezclen datos de los dos locales.
- **Prioridad:** El fix 3.1 (navegación de mesas en POS Restaurante) es el de mayor impacto operativo inmediato ya que afecta el flujo de trabajo diario en Android.
- **Datos del menú:** El seed `scripts/seed-shanklish-menu.ts` ya carga el menú completo de Shanklish Caracas con SKUs `SHNK-*`. Verificar que esos items estén vinculados al restaurante/zona correcta en la BD antes de operar el POS.
