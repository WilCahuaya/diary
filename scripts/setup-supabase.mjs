#!/usr/bin/env node
/**
 * Guía interactiva para configurar Supabase.
 * Uso: npm run setup:supabase
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

function step(n, title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Paso ${n}: ${title}`);
  console.log("─".repeat(60));
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║         Configuración de Supabase — Mi Diario            ║
╚══════════════════════════════════════════════════════════╝
`);

// Paso 1: .env.local
step(1, "Variables de entorno");

if (!existsSync(join(ROOT, ".env.local"))) {
  copyFileSync(join(ROOT, ".env.example"), join(ROOT, ".env.local"));
  console.log("  → Creado .env.local desde .env.example");
} else {
  console.log("  → .env.local ya existe");
}

console.log(`
  Abre .env.local y completa:

  NEXT_PUBLIC_SUPABASE_URL       → Settings → API → Project URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY  → Settings → API → anon / publishable key
  SUPABASE_SERVICE_ROLE_KEY      → Settings → API → service_role (secreta)
  NEXT_PUBLIC_APP_URL            → http://localhost:3000 (o tu dominio)
`);

// Paso 2: Proyecto Supabase
step(2, "Crear proyecto en Supabase");

console.log(`
  1. Ve a https://supabase.com/dashboard
  2. New project → elige nombre, contraseña de BD y región
  3. Espera a que el proyecto esté listo (~2 min)
  4. Copia las claves al .env.local (Paso 1)
`);

// Paso 3: SQL
step(3, "Aplicar esquema de base de datos");

const migration1 = readFileSync(
  join(ROOT, "supabase/migrations/001_initial_schema.sql"),
  "utf8"
);
const migration2 = readFileSync(
  join(ROOT, "supabase/migrations/002_storage_policies.sql"),
  "utf8"
);
const combinedSql = `-- Mi Diario — setup completo\n-- Ejecutar en: Supabase Dashboard → SQL Editor → New query\n\n${migration1}\n\n${migration2}\n`;

const setupPath = join(ROOT, "supabase/setup-all.sql");
writeFileSync(setupPath, combinedSql);

console.log(`
  Opción A — SQL Editor (recomendada):
    1. Dashboard → SQL Editor → New query
    2. Pega el contenido de: supabase/setup-all.sql
    3. Run

  Opción B — Supabase CLI:
    npx supabase login
    npx supabase link --project-ref TU_PROJECT_REF
    npx supabase db push

  Archivo generado: supabase/setup-all.sql
`);

// Paso 4: Auth URLs
step(4, "Configurar autenticación");

console.log(`
  Dashboard → Authentication → URL Configuration:

  Site URL:
    http://localhost:3000

  Redirect URLs (añadir ambas):
    http://localhost:3000/auth/callback
    http://localhost:3000/reset-password

  (En producción, añade también tu dominio real)
`);

// Paso 5: Usuario único
step(5, "Crear el único usuario");

console.log(`
  Dashboard → Authentication → Users → Add user → Create new user
    • Email + contraseña del propietario del diario

  Después de crearlo:
    Authentication → Providers → Email
    → Desactiva "Enable sign ups" (solo tú debes acceder)
`);

// Paso 6: Verificar
step(6, "Verificar");

console.log(`
  Cuando .env.local esté completo y el SQL ejecutado:

    npm run verify:supabase

  Si todo está bien:

    npm run dev
    → http://localhost:3000/login
`);

try {
  execSync("node scripts/verify-supabase.mjs", { stdio: "inherit", cwd: ROOT });
} catch {
  console.log("\n  (Verificación pendiente — completa los pasos anteriores primero)\n");
}
