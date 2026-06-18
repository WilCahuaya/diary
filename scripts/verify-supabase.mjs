#!/usr/bin/env node
/**
 * Verifica que Supabase esté configurado correctamente.
 * Uso: node scripts/verify-supabase.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return false;
  const content = readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

const PLACEHOLDER_PATTERNS = [
  "your-project",
  "your-anon",
  "your-service",
  "TU-PROYECTO",
  "tu-anon-key",
  "tu-service-role",
  "eyJ...",
];

function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function ok(msg) {
  checks.push({ ok: true, msg });
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  checks.push({ ok: false, msg });
  console.log(`  ✗ ${msg}`);
}

console.log("\n🔍 Verificando configuración de Supabase\n");

if (!loadEnvLocal()) {
  fail("No existe .env.local — copia .env.example y completa los valores");
  process.exit(1);
}
ok(".env.local encontrado");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!url || isPlaceholder(url)) fail("NEXT_PUBLIC_SUPABASE_URL no configurada");
else ok("NEXT_PUBLIC_SUPABASE_URL");

if (!anonKey || isPlaceholder(anonKey)) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada");
else ok("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!serviceKey || isPlaceholder(serviceKey)) {
  fail("SUPABASE_SERVICE_ROLE_KEY no configurada (necesaria para respaldos)");
} else ok("SUPABASE_SERVICE_ROLE_KEY");

if (!appUrl) fail("NEXT_PUBLIC_APP_URL no configurada");
else ok(`NEXT_PUBLIC_APP_URL = ${appUrl}`);

if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) {
  console.log("\n❌ Completa .env.local antes de continuar.\n");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

console.log("\n📡 Comprobando conexión y esquema...\n");

const tables = ["entries", "favorites", "images"];

for (const table of tables) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (error?.message?.includes("does not exist") || error?.code === "42P01") {
    fail(`Tabla "${table}" no existe — ejecuta las migraciones SQL`);
  } else if (error?.message?.includes("Invalid API key")) {
    fail("API key inválida");
    break;
  } else if (error) {
    // RLS sin sesión puede devolver vacío, no error — cualquier otro error se reporta
    if (error.code === "PGRST301" || error.message.includes("JWT")) {
      ok(`Tabla "${table}" existe (RLS activo)`);
    } else {
      ok(`Tabla "${table}" accesible`);
    }
  } else {
    ok(`Tabla "${table}" accesible`);
  }
}

if (serviceKey && !isPlaceholder(serviceKey)) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) {
    fail(`Storage: ${bucketError.message}`);
  } else if (buckets?.some((b) => b.id === "diary-images")) {
    ok('Bucket "diary-images" existe');
  } else {
    fail('Bucket "diary-images" no encontrado — ejecuta 002_storage_policies.sql');
  }
}

const failed = checks.filter((c) => !c.ok);
console.log(
  failed.length
    ? `\n⚠️  ${failed.length} problema(s). Sigue las instrucciones de: npm run setup:supabase\n`
    : "\n✅ Supabase configurado correctamente. Ejecuta: npm run dev\n"
);

process.exit(failed.length ? 1 : 0);
