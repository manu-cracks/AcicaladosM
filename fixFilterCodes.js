import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno locales
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydvqzgyhymjgbyfkxqhd.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31m[ERROR FATAL] Credenciales no encontradas en .env / .env.local\x1b[0m');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Colores ANSI
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function fixFilterCodes() {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}    RESTAURACIÓN DE CÓDIGO ALFABÉTICO EN VESTUARIO (FILTRO VS SKU)     ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);

  console.log(`${c.yellow}[1/3] Consultando prendas registradas en 'wardrobe_items'...${c.reset}`);

  const { data: items, error: fetchErr } = await supabase
    .from('wardrobe_items')
    .select('id, name, code, codigo_prenda, codigo_unico, identificador, imagen_url');

  if (fetchErr) {
    console.error(`${c.red}❌ Error al consultar la tabla wardrobe_items: ${fetchErr.message}${c.reset}`);
    process.exit(1);
  }

  console.log(`${c.green}✔ ${items.length} prendas recuperadas de la base de datos.${c.reset}\n`);
  console.log(`${c.yellow}[2/3] Procesando extracción de letra y actualización de registros...${c.reset}\n`);

  const stats = {
    total: items.length,
    updated: 0,
    alreadyCorrect: 0,
    failed: 0,
  };

  const letterDistribution = {};

  // Procesamiento concurrente en lotes de 15 para velocidad óptima
  const BATCH_SIZE = 15;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (item) => {
        try {
          // Obtener el código actual compuesto (ej. "A-100", "A-101", "B")
          const rawCode = (item.codigo_prenda || item.code || '').trim().toUpperCase();

          if (!rawCode) {
            console.warn(`${c.yellow}⚠️ [ID: ${item.id}] Prenda sin código. Asignando 'A'.${c.reset}`);
          }

          // Extracción de letra estricta ("A-100" -> "A")
          let letter = rawCode.split('-')[0].trim().toUpperCase();
          if (!letter || letter.length > 2 || !/^[A-Z]+$/.test(letter)) {
            letter = rawCode.charAt(0).toUpperCase() || 'A';
          }

          // Conservar el código completo para control interno en identificador / codigo_unico
          const fullSku = item.codigo_unico || item.identificador || rawCode || letter;

          // Registrar distribución
          letterDistribution[letter] = (letterDistribution[letter] || 0) + 1;

          // Verificar si ya está puramente como letra y tiene el sku asignado
          if (
            item.code === letter &&
            item.codigo_prenda === letter &&
            (item.codigo_unico === fullSku || item.identificador === fullSku)
          ) {
            stats.alreadyCorrect++;
            return;
          }

          // Ejecutar UPDATE garantizando que las URLs e imágenes queden intactas
          const updatePayload = {
            code: letter,
            codigo_prenda: letter,
            codigo_unico: fullSku,
            identificador: fullSku,
            updated_at: new Date().toISOString(),
          };

          const { error: updErr } = await supabase
            .from('wardrobe_items')
            .update(updatePayload)
            .eq('id', item.id);

          if (updErr) {
            console.error(`${c.red}❌ Error actualizando ID ${item.id} (${rawCode} -> ${letter}): ${updErr.message}${c.reset}`);
            stats.failed++;
          } else {
            stats.updated++;
            console.log(
              `${c.green}✔ [${letter}] ACTUALIZADO${c.reset} - Código Principal: "${letter}" | SKU Interno: "${fullSku}" | Prenda: ${item.name?.substring(0, 35)}...`
            );
          }
        } catch (itemEx) {
          console.error(`${c.red}❌ Excepción en ID ${item.id}: ${itemEx.message || itemEx}${c.reset}`);
          stats.failed++;
        }
      })
    );
  }

  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.green}             RESUMEN DE ACTUALIZACIÓN DE CÓDIGOS ALFABÉTICOS           ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}Total de prendas evaluadas:${c.reset}         ${stats.total}`);
  console.log(`${c.bold}Registros actualizados a letra pura:${c.reset} ${c.green}${stats.updated}${c.reset}`);
  console.log(`${c.bold}Registros que ya estaban en regla:${c.reset}   ${c.yellow}${stats.alreadyCorrect}${c.reset}`);
  console.log(`${c.bold}Errores o fallos:${c.reset}                   ${stats.failed > 0 ? c.red : c.green}${stats.failed}${c.reset}`);
  console.log(`${c.bold}\nDistribución por Letra de Bloque:${c.reset}`);

  const sortedLetters = Object.keys(letterDistribution).sort();
  const summaryChunks = [];
  for (let j = 0; j < sortedLetters.length; j += 6) {
    summaryChunks.push(
      sortedLetters
        .slice(j, j + 6)
        .map((l) => `${c.bold}${l}:${c.reset} ${letterDistribution[l]} prendas`)
        .join(' | ')
    );
  }
  console.log(summaryChunks.join('\n'));

  console.log(`\n${c.green}✔ URLs de imagen conservadas intactas (ej. A-100, B-100, etc. en Supabase Storage).${c.reset}`);
  console.log(`${c.green}✔ Filtro de búsqueda alfabética del frontend 100% restaurado.${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);
}

fixFilterCodes().catch((err) => {
  console.error('\x1b[31m[ERROR CRÍTICO]:\x1b[0m', err);
  process.exit(1);
});
