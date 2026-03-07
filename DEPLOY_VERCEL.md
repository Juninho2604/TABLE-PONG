# Deploy Table Pong ERP en Vercel

## 1. Subir a GitHub

Si aún no creaste el repositorio:

1. Ve a [github.com/new](https://github.com/new)
2. Nombre sugerido: `tablepong-erp`
3. Crea el repo **sin** README ni .gitignore (ya existen)
4. Ejecuta en tu proyecto:

```bash
git remote add origin https://github.com/TU_USUARIO/tablepong-erp.git
git branch -M main
git push -u origin main
```

(Reemplaza `TU_USUARIO` por tu usuario de GitHub)

## 2. Variables de entorno en Vercel

En **Vercel Dashboard** → tu proyecto → **Settings** → **Environment Variables**, agrega:

| Variable | Valor | Entornos |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://neondb_owner:TU_PASSWORD@ep-proud-wildflower-adaw38y6-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Production, Preview |
| `NEXTAUTH_URL` | `https://tu-dominio.vercel.app` (o la URL que Vercel te asigne) | Production |
| `NEXTAUTH_SECRET` | Genera uno con `openssl rand -base64 32` | Production, Preview |
| `JWT_SECRET` | `tablepong-super-secret-key-2024` (o uno más seguro) | Production, Preview |

**Importante:** Después del primer deploy, Vercel te dará una URL (ej: `tablepong-erp.vercel.app`). Actualiza `NEXTAUTH_URL` con esa URL y redeploya.

## Pasos para deploy

1. Conecta el repo de GitHub a Vercel
2. Agrega las variables de entorno
3. Deploy automático al hacer push
