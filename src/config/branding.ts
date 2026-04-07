export interface TenantBranding {
  id: string
  name: string
  shortName: string
  logoText: string
  logoIcon: string
  primaryHSL: string
  accentHSL: string
  receiptHeader: string[]
  receiptFooter: string[]
  currency: { primary: string; secondary?: string; symbol: string; secondarySymbol?: string }
  timezone: string
  dateFormat: string
  locale: string
  modules: string[]
  features: {
    intercompany: boolean; games: boolean; sportBar: boolean; delivery: boolean
    pickup: boolean; wristbands: boolean; proteinProcessing: boolean
    exchangeRate: boolean; cashSession: boolean; subcuentas: boolean; mesoneros: boolean
  }
}

export const TENANTS: Record<string, TenantBranding> = {
  'table-pong': {
    id: 'table-pong',
    name: 'Table Pong Santa Paula',
    shortName: 'Table Pong',
    logoText: 'Table Pong',
    logoIcon: 'TP',
    primaryHSL: '142 76% 36%',
    accentHSL: '221 83% 53%',
    receiptHeader: ['TABLE PONG SANTA PAULA', 'Sport Bar & Restaurante', 'RIF: J-XXXXXXXXX-X'],
    receiptFooter: ['Gracias por su visita', '¡Vuelva pronto!'],
    currency: { primary: 'USD', secondary: 'VES', symbol: '$', secondarySymbol: 'Bs' },
    timezone: 'America/Caracas',
    dateFormat: 'dd/MM/yyyy',
    locale: 'es-VE',
    modules: ['DASHBOARD','POS','INVENTORY','PRODUCTION','RECIPES','PURCHASES',
              'TRANSFERS','LOANS','AUDITS','GAMES','INTERCOMPANY','COSTS','MENU',
              'USERS','CONFIG','MESONEROS','SKU_STUDIO','ANNOUNCEMENTS',
              'GASTOS','CUENTAS_PAGAR','FINANZAS'],
    features: {
      intercompany: true, games: true, sportBar: true, delivery: true,
      pickup: true, wristbands: true, proteinProcessing: true,
      exchangeRate: true, cashSession: true, subcuentas: true, mesoneros: true,
    },
  },
  'shanklish': {
    id: 'shanklish',
    name: 'Shanklish Caracas',
    shortName: 'Shanklish',
    logoText: 'Shanklish',
    logoIcon: 'SC',
    primaryHSL: '25 95% 53%',
    accentHSL: '160 84% 39%',
    receiptHeader: ['SHANKLISH CARACAS', 'Cocina Árabe & Mediterránea', 'RIF: J-XXXXXXXXX-X'],
    receiptFooter: ['Gracias por preferirnos', '@shanklishcaracas'],
    currency: { primary: 'USD', secondary: 'VES', symbol: '$', secondarySymbol: 'Bs' },
    timezone: 'America/Caracas',
    dateFormat: 'dd/MM/yyyy',
    locale: 'es-VE',
    modules: ['DASHBOARD','POS','INVENTORY','PRODUCTION','RECIPES','PURCHASES',
              'TRANSFERS','LOANS','AUDITS','INTERCOMPANY','COSTS','MENU',
              'USERS','CONFIG','MESONEROS','SKU_STUDIO','ANNOUNCEMENTS',
              'GASTOS','CUENTAS_PAGAR','FINANZAS'],
    features: {
      intercompany: true, games: false, sportBar: false, delivery: true,
      pickup: true, wristbands: false, proteinProcessing: true,
      exchangeRate: true, cashSession: true, subcuentas: true, mesoneros: true,
    },
  },
}

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'table-pong'
export const getTenant = (): TenantBranding => TENANTS[TENANT_ID] ?? TENANTS['table-pong']
export const getTenantName = () => getTenant().shortName
export const getTenantFullName = () => getTenant().name
export const isModuleEnabled = (m: string) => getTenant().modules.includes(m)
export const isFeatureEnabled = (f: keyof TenantBranding['features']) => getTenant().features[f] ?? false
export const getCurrency = () => getTenant().currency
export const getReceiptHeader = () => getTenant().receiptHeader
export const getReceiptFooter = () => getTenant().receiptFooter
