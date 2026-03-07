# Configuración local - Table Pong ERP

## Acceso al Dashboard

Para acceder al dashboard localmente necesitas:

1. **Base de datos Neon** con credenciales válidas en `.env`
2. **Usuarios creados** ejecutando el seed

### Pasos

1. Verifica tu `DATABASE_URL` en `.env`. Si Neon te dio credenciales nuevas, actualízalas.

2. Sincroniza el esquema y crea los usuarios:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

3. Inicia el servidor:
   ```bash
   npm run dev
   ```

4. Entra a http://localhost:3000/login y usa:
   - **Email:** `admin@tablepong.com`
   - **Contraseña:** `tablepong123`

### Otros usuarios de prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@tablepong.com | tablepong123 |
| Cajero | cajero@tablepong.com | tablepong123 |
| Chef | chef@tablepong.com | tablepong123 |

### Si la conexión a Neon falla

- Entra a [Neon Console](https://console.neon.tech) y verifica que el proyecto existe.
- Resetea la contraseña si es necesario y actualiza `DATABASE_URL` en `.env`.
- Asegúrate de usar la URL con **pooler** (`-pooler` en el host) para mejor compatibilidad.
