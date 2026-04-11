import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Resolve the connection string natively from the environment configuration
const connectionString = `${process.env.DATABASE_URL}`

// Generate the Connection Pool explicitly
const pool = new Pool({ connectionString })

// Initialize the Prisma 7 native Postgres Driver Adapter
const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Instantiate the Prisma Client globally using the new explicit adapter pattern
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
