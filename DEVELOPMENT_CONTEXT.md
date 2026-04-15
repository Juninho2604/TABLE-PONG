# TABLE PONG ERP — Contexto de Desarrollo
**Última actualización:** 2026-04-15

Este archivo es la memoria central del proyecto. Cualquier IA o desarrollador que continúe el trabajo debe leerlo primero.

---

## 1. Descripción del Proyecto
ERP completo para **Table Pong Caracas** (Sport Bar + Restaurante). Gestiona operaciones, inventario, producción, ventas y punto de venta.

- **Framework:** Next.js 14 (App Router, React 18, TypeScript)
- **Base de Datos:** PostgreSQL (Neon serverless) vía Prisma ORM
- **Estilos:** Tailwind CSS (dark theme, mobile-first)
- **Autenticación:** JWT Session personalizada (Server Actions + Cookies httpOnly)
- **Despliegue:** Vercel (CD automático desde `main`)
- **Branch de trabajo activo:** `claude/optimize-android-interface-Kp0tw`

---

## 2. Módulos Implementados

### POS Restaurante (`src/app/dashboard/pos/restaurante/page.tsx`)
Archivo principal ~2200 líneas. Maneja toda la UI del punto de venta.

**Flujo principal:**
1. Cajera selecciona mesa → abre cuenta (OpenTab) — solo alias opcional + personas + mesonero
2. Agrega productos al carrito (comandas van a cocina)
3. Al cobrar: vincula cliente fiscal (cédula/RIF/pasaporte) en panel "Cobrar cuenta" → confirma con PIN
4. Se imprime factura automáticamente con equivalente en Bs

**Estado y props clave:**
- `carts: Record<string, CartItem[]>` — carritos por mesa (`tableId`) o pickup (`'__pickup__'`)
- `exchangeRate: number | null` — tasa BCV actual, actualizable desde la calculadora de moneda
- `tabPaymentCustomer: CustomerRecord | null` — cliente fiscal vinculado al cobrar (no al abrir mesa)
- `pickupCustomer: CustomerRecord | null` — cliente fiscal en venta directa
- `discountType: "NONE"|"DIVISAS_33"|"CORTESIA_100"|"CORTESIA_PERCENT"` — modo de descuento activo
- `useMultiPayment: boolean` — pago mixto (múltiples métodos)
- `serviceFeeIncluded: boolean` — 10% cargo de servicio

**Métodos de pago:**
`CASH` (USD efectivo), `ZELLE`, `CARD`, `TRANSFER`, `MOBILE_PAY`, `CASH_BS` (bolívares)

**Descuentos:**
- `DIVISAS_33` — 33.33% descuento exclusivo para pago en CASH/ZELLE. Bloquea con PIN para cambiar.
- `CORTESIA_100` / `CORTESIA_PERCENT` — cortesía total/parcial, requiere PIN gerencial + razón
- En pago mixto: `DIVISAS_33` se limpia; el descuento divisas es parcial sobre las líneas CASH/ZELLE (`amount * 0.5`)

**Pickup (Venta Directa):**
- Contexto `__pickup__` en el mapa de carritos
- `pickupTotal`, `mixedPickupBase` = monto base para validación y botón en modo mixto
- `pickupPartialDivisasDiscount` = descuento divisas solo para líneas CASH/ZELLE en mixto

**Pre-cuenta (Estado de Cuenta):**
- `handlePrintEstadoDeCuenta()` — abre popup con items + total normal + total con descuento divisas
- Muestra equivalentes en Bs para ambos totales si `exchangeRate` está disponible
- Contador de impresiones con alerta WA si > 2 copias (`preBillWAAlert`)

**Recibos (`src/lib/print-command.ts`):**
- `printReceipt(data: ReceiptData)` — abre popup con recibo térmico 80mm
- `ReceiptData.exchangeRate?: number` — si se pasa, muestra `EQUIV. BCV (Bs): Bs. X.XX` y la tasa
- El monto en Bs es del **total final incluyendo 10% servicio** (cuando aplica)
- `printKitchenCommand(data)` — comanda de cocina sin precios

---

### Cartera de Clientes Fiscales

**Schema (`Customer` en `prisma/schema.prisma`):**
```prisma
model Customer {
  id          String    @id @default(cuid())
  name        String
  docType     String?   // CEDULA_V|CEDULA_E|RIF_J|RIF_V|RIF_G|RIF_C|RIF_E|PASAPORTE
  docNumber   String?   @unique
  phone       String?
  email       String?
  notes       String?
  isActive    Boolean   @default(true)
  visitCount  Int       @default(0)
  totalSpent  Float     @default(0)   // acumulado USD
  lastVisitAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  salesOrders SalesOrder[]
  openTabs    OpenTab[]
}
```

**Actions (`src/app/actions/customer.actions.ts`):**
- `searchCustomersAction(query)` — busca por nombre, docNumber, teléfono, email; top 10 frecuentes si query vacío
- `createCustomerAction(data)` — crea cliente; deduplica por `docNumber` (si hay conflicto devuelve el existente)
- `updateCustomerAction(id, data)` — actualiza datos; verifica unicidad de `docNumber`
- `recordCustomerVisitAction(id, amountSpent?)` — incrementa `visitCount` + `lastVisitAt` + `totalSpent`

**Tipos exportados:**
- `DocType`: `CEDULA_V | CEDULA_E | RIF_J | RIF_V | RIF_G | RIF_C | RIF_E | PASAPORTE`
- `CustomerRecord`: interfaz con todos los campos incluyendo `docType`, `docNumber`, `totalSpent`
- `formatDocId(docType, docNumber)` → `"V-12345678"` para mostrar en UI
- `DOC_TYPE_LABELS`, `DOC_TYPE_DISPLAY` — mapas de prefijos y descripciones

**Componente (`src/components/pos/CustomerSelector.tsx`):**
- Props: `value: CustomerRecord | null`, `onSelect`, `triggerLabel?`, `className?`
- Modal portal con selector de tipo de doc (pills: V- E- J- G- C- PAS)
- Input numérico con prefijo visual fijo
- Resultados: avatar con iniciales, nombre, doc fiscal, teléfono, visitas, total gastado USD
- Chip compacto cuando hay cliente seleccionado (editar/quitar)
- Formulario inline de creación
- **Ubicación en tab payment:** panel "Cobrar cuenta" sección "0. Cliente fiscal"
- **Ubicación en pickup:** header del panel pickup

**Trazabilidad fiscal:**
- `customerId` se pasa a `registerOpenTabPaymentAction` → guarda en `OpenTab` y `SalesOrder` consolidada al cerrar
- `customerId` se pasa a `createSalesOrderAction` en pickup
- `recordCustomerVisitAction(id, amount)` llamado en ambos flujos al cobrar exitosamente

---

### Tasa de Cambio (`src/app/actions/exchange.actions.ts`)
- Tasa BCV almacenada en `ExchangeRate` table
- Actualizable por roles: `OWNER, ADMIN_MANAGER, OPS_MANAGER, CASHIER_RESTAURANT, CASHIER_DELIVERY`
- `getExchangeRateValue()` — devuelve el número redondeado a 2 decimales
- En el POS: `CurrencyCalculator` component con prop `onRateUpdated={setExchangeRate}` sincroniza la tasa en tiempo real

---

### POS Actions (`src/app/actions/pos.actions.ts`)
Interfaces clave:
```typescript
interface RegisterOpenTabPaymentInput {
  openTabId: string;
  amount: number;
  paymentMethod: POSPaymentMethod;
  paymentSplits?: { method: POSPaymentMethod; amount: number }[];
  discountAmount?: number;
  customerId?: string;  // ← vinculado al cobrar
  // ...otros campos
}

interface OpenTabInput {
  tableOrStationId: string;
  customerLabel?: string;   // alias display (no teléfono)
  customerId?: string;
  guestCount?: number;
  waiterLabel?: string;
  // ...otros campos
}
```

**`registerOpenTabPaymentAction`:**
- Cuando se pasa `customerId`: actualiza `OpenTab.customerId` + `SalesOrder.customerId` en la orden consolidada
- `effectiveCustomerId = data.customerId || openTab.customerId` — respeta el que ya tenía la cuenta

---

## 3. Roles y Permisos

| Rol | POS | Descuentos | Tasa | Cortesía |
|-----|-----|-----------|------|---------|
| `OWNER` | ✅ | ✅ | ✅ | ✅ |
| `ADMIN_MANAGER` | ✅ | ✅ | ✅ | ✅ |
| `OPS_MANAGER` | ✅ | ✅ | ✅ | ✅ |
| `CASHIER_RESTAURANT` | ✅ | ✅ | ✅ | ✅ |
| `CASHIER_DELIVERY` | ✅ | ✅ | ✅ | — |
| `AREA_LEAD` | ✅ | ✅ | — | — |

---

## 4. Decisiones Arquitectónicas Importantes

1. **Carritos por mesa:** `carts: Record<string, CartItem[]>` en lugar de un solo `cart[]`. Permite navegar entre mesas sin perder el carrito.

2. **Cliente fiscal en cobro, no en apertura:** La cédula/RIF/pasaporte se captura en el panel "Cobrar cuenta", no al abrir la mesa. Reduce fricción operacional.

3. **Pago mixto + divisas:** Al activar "Pago Mixto", el modo `DIVISAS_33` se limpia automáticamente para evitar doble descuento. El descuento divisas en mixto es `amount * 0.5` por cada línea CASH/ZELLE.

4. **Pre-cuenta siempre en popup HTML:** Se usa `window.open()` con HTML inline para impresión térmica. No depende de librerías externas.

5. **Equivalente Bs en recibos:** `ReceiptData.exchangeRate` es opcional. Si se pasa, se añade una línea `EQUIV. BCV (Bs): Bs. X.XX` después del total final. El monto base es `totalConServicio` (incluye 10% servicio si aplica).

6. **Versión optimista en OpenTab:** `assertOpenTabVersionUpdate` previene conflictos de concurrencia con campo `version`.

---

## 5. Variables de Entorno

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
NEXTAUTH_SECRET="..."
GOOGLE_VISION_API_KEY="..."  # solo si se reactiva OCR
```

---

## 6. Comandos Útiles

```bash
# Desarrollo local
npm run dev

# Regenerar Prisma client (sin DB local)
DATABASE_URL="postgresql://placeholder:placeholder@localhost/placeholder" ./node_modules/.bin/prisma generate

# Type check
./node_modules/.bin/tsc --noEmit

# Push a rama de trabajo
git push -u origin claude/optimize-android-interface-Kp0tw
```

---

## 7. Historial de Cambios (reciente → antiguo)

### 2026-04-15 — Equivalente Bs en recibos y pre-cuenta
- `printReceipt`: nuevo campo `exchangeRate?: number` en `ReceiptData`. Cuando se pasa, añade bloque `EQUIV. BCV (Bs)` + tasa al final del recibo (total incluyendo 10% servicio).
- `handlePrintEstadoDeCuenta`: muestra `Equiv. Bs (BCV)` para el total normal y para el total con descuento divisas.
- Los tres `printReceipt` calls en `page.tsx` (tab pago, pickup, reimpresión) pasan `exchangeRate`.

### 2026-04-15 — Rediseño sistema de clientes fiscales
- **Schema:** `Customer` agrega `docType`, `docNumber (@unique)`, `totalSpent`; `phone` deja de ser `@unique`.
- **`customer.actions.ts`:** identificación primaria por cédula/RIF/pasaporte; `recordCustomerVisitAction` acumula `totalSpent`.
- **`CustomerSelector.tsx`:** rediseño completo — pills tipo doc (V-/E-/J-/G-/C-/PAS), input con prefijo visual, tarjetas con doc+gasto, chip compacto.
- **Modal "Abrir cuenta":** eliminado campo teléfono obligatorio. Solo alias (opcional) + personas + mesonero.
- **"Cobrar cuenta":** nueva sección "0. Cliente fiscal" con `CustomerSelector`; `customerId` se registra en `OpenTab` y `SalesOrder` al cobrar.

### 2026-04 (sesiones previas) — POS Restaurante completado
- Cartera de clientes base (fase 1), acceso cajera a tasa de cambio
- Fix pago mixto + divisas (doble descuento), fix precuenta y pickup
- Per-table cart isolation con `carts: Record<string, CartItem[]>`
