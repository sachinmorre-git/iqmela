import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'QUEUED_FOR_AI'`);
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'EXTRACTING'`);
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'EXTRACTED'`);
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'RANKING'`);
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'RANKED'`);
    
    // Migrate old values
    await client.query(`UPDATE "Resume" SET "parsingStatus" = 'EXTRACTED' WHERE "parsingStatus" = 'COMPLETED'`);
    await client.query(`UPDATE "Resume" SET "parsingStatus" = 'EXTRACTING' WHERE "parsingStatus" = 'PROCESSING'`);
    await client.query(`UPDATE "Resume" SET "parsingStatus" = 'QUEUED_FOR_AI' WHERE "parsingStatus" = 'QUEUED'`);
    
    console.log('Postgres constraints successfully padded for Prisma Schema sync!');
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await client.end();
  }
}
run();
