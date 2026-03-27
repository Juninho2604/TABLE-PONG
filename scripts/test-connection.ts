import 'dotenv/config';
import ws from 'ws';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// Usar WebSockets para entornos donde el puerto 5432 esta bloqueado
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log('✅ Conexion exitosa:', result);
    const user = await prisma.user.findFirst({ select: { id: true, name: true, role: true } });
    console.log('👤 Primer usuario:', user);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
