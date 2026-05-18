
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // Plain process.env (with a harmless placeholder) so `prisma generate`
    // can run at build time without DATABASE_URL being set. Commands that
    // actually touch the database (db push, migrate) will still error if
    // it's missing — which is the right behaviour.
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder@localhost:5432/none",
  },
});
