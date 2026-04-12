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
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'UPLOADED'`);
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'QUEUED'`);
    await client.query(`ALTER TYPE "ResumeParsingStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`);
    await client.query(`UPDATE "Resume" SET "parsingStatus" = 'COMPLETED' WHERE "parsingStatus" = 'DONE'`);
    await client.query(`UPDATE "Resume" SET "parsingStatus" = 'UPLOADED' WHERE "parsingStatus" = 'PENDING'`);
    console.log('Resumes updated with new enums.');
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await client.end();
  }
}
run();
