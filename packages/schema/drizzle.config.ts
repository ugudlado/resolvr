import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/template_dev';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    prefix: 'timestamp', // Options: 'timestamp', 'supabase', 'index', 'unix', 'none'
    table: '__drizzle_migrations',
    schema: 'public',
  },
});
