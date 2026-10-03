import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydvqzgyhymjgbyfkxqhd.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31m[ERROR FATAL] Credenciales no encontradas en .env.local\x1b[0m');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function restoreUniqueCodes() {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}    RESTAURACIÓN ESTRICTA DE CÓDIGOS ÚNICOS EN 'wardrobe_items'        ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);

  // 1. Cargar base de datos local JSON de referencia (D:/SistemasMANU/IMAGENESvestido)
  const masterFolder = path.join(__dirname, '..', 'IMAGENESvestido');
  const localMapByCode = new Map();
  const localMapByImageName = new Map();

  if (fs.existsSync(masterFolder)) {
    console.log(`${c.yellow}[1/4] Leyendo archivos JSON locales en ${masterFolder}...${c.reset}`);
    const subfolders = fs.readdirSync(masterFolder).filter(f => fs.statSync(path.join(masterFolder, f)).isDirectory());
    for (const folder of subfolders) {
      const p = path.join(masterFolder, folder);
      const jsonFile = fs.readdirSync(p).find(f => f.endsWith('.json'));
      if (jsonFile) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(p, jsonFile), 'utf8'));
          content.forEach(item => {
            if (item.codigo) {
              const cleanCode = item.codigo.trim().toUpperCase();
              localMapByCode.set(cleanCode, item);
              if (item.ruta_imagen) {
                const baseImg = path.basename(item.ruta_imagen).toLowerCase();
                localMapByImageName.set(`${folder.toUpperCase()}/${baseImg}`, item);
              }
            }
          });
        } catch (e) {
          console.warn(`Error leyendo JSON en ${folder}:`, e.message);
        }
      }
    }
    console.log(`${c.green}✔ ${localMapByCode.size} códigos únicos cargados de los JSON locales.${c.reset}\n`);
  } else {
    console.log(`${c.yellow}[1/4] Directorio maestro externo no encontrado directo, usando datos ya presentes en BD.${c.reset}\n`);
  }

  // 2. Consultar prendas en Supabase
  console.log(`${c.yellow}[2/4] Consultando prendas en 'wardrobe_items'...${c.reset}`);
  const { data: items, error: fetchErr } = await supabase
    .from('wardrobe_items')
    .select('id, name, code, codigo_prenda, codigo_unico, identificador, imagen_url');

  if (fetchErr) {
    console.error(`${c.red}❌ Error al consultar la tabla wardrobe_items: ${fetchErr.message}${c.reset}`);
    process.exit(1);
  }

  console.log(`${c.green}✔ ${items.length} prendas obtenidas de la base de datos.${c.reset}\n`);
  console.log(`${c.yellow}[3/4] Restaurando código único original (ej. A-101)...${c.reset}\n`);

  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let errorCount = 0;

  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (item) => {
        try {
          // Determinar el código único original
          let targetSku = (item.codigo_unico || item.identificador || '').trim().toUpperCase();

          // Si el SKU guardado era una sola letra o no tiene guión, buscar en el nombre de archivo de la imagen
          if (!targetSku || targetSku.length <= 2 || !targetSku.includes('-')) {
            if (item.imagen_url) {
              // Ej: https://.../wardrobe-images/A-106-1790986054787-779.webp -> "A-106"
              const urlParts = item.imagen_url.split('/');
              const filename = urlParts[urlParts.length - 1];
              const match = filename.match(/^([A-Z]+-\d+)/i);
              if (match) {
                targetSku = match[1].toUpperCase();
              }
            }
          }

          // Fallbacks para los 3 registros manuales de prueba
          if (!targetSku || !targetSku.includes('-')) {
            if (item.name === 'DXX') targetSku = 'E-999';
            else if (item.name === 'prueba2') targetSku = 'B-999';
            else if (item.name === 'TEST PROBE') targetSku = 'TEST-999';
            else targetSku = `${item.code || 'A'}-999`;
          }

          // Verificar si ya está completamente sincronizado
          if (
            item.code === targetSku &&
            item.codigo_prenda === targetSku &&
            item.codigo_unico === targetSku &&
            item.identificador === targetSku
          ) {
            alreadyCorrectCount++;
            return;
          }

          // Actualizar registros con el código único restaurado
          const updatePayload = {
            code: targetSku,
            codigo_prenda: targetSku,
            codigo_unico: targetSku,
            identificador: targetSku,
            updated_at: new Date().toISOString(),
          };

          const { error: updErr } = await supabase
            .from('wardrobe_items')
            .update(updatePayload)
            .eq('id', item.id);

          if (updErr) {
            console.error(`${c.red}❌ Error en ID ${item.id} (${targetSku}): ${updErr.message}${c.reset}`);
            errorCount++;
          } else {
            updatedCount++;
            if (updatedCount <= 10 || updatedCount % 50 === 0) {
              console.log(`${c.green}✔ RESTAURADO: [${targetSku}]${c.reset} - ${item.name?.substring(0, 40)}...`);
            }
          }
        } catch (ex) {
          console.error(`${c.red}❌ Excepción en ID ${item.id}: ${ex.message}${c.reset}`);
          errorCount++;
        }
      })
    );
  }

  console.log(`\n${c.bold}Resultado de 'wardrobe_items':${c.reset}`);
  console.log(`- Prendas actualizadas al SKU único: ${c.green}${updatedCount}${c.reset}`);
  console.log(`- Prendas que ya estaban correctas:  ${c.yellow}${alreadyCorrectCount}${c.reset}`);
  console.log(`- Errores:                           ${errorCount > 0 ? c.red : c.green}${errorCount}${c.reset}\n`);

  // 4. Sincronizar 'dress_rentals' (Garantizar que reservas activas usen el código único exacto)
  console.log(`${c.yellow}[4/4] Verificando y corrigiendo órdenes en 'dress_rentals'...${c.reset}`);
  const { data: rentals, error: rentErr } = await supabase
    .from('dress_rentals')
    .select('id, ticket_code, item_code, wardrobe_item_id, item_name');

  if (rentErr) {
    console.error(`${c.red}❌ Error consultando dress_rentals: ${rentErr.message}${c.reset}`);
  } else if (rentals) {
    let correctedRentals = 0;
    for (const r of rentals) {
      // Si el item_code es solo una letra (ej. "A"), resolver el código único correspondiente
      if (r.item_code && (r.item_code.length <= 2 || !r.item_code.includes('-'))) {
        let uniqueCode = null;
        if (r.wardrobe_item_id) {
          const { data: wItem } = await supabase
            .from('wardrobe_items')
            .select('code, codigo_unico')
            .eq('id', r.wardrobe_item_id)
            .single();
          if (wItem) {
            uniqueCode = wItem.code || wItem.codigo_unico;
          }
        }

        if (uniqueCode) {
          const { error: updRentErr } = await supabase
            .from('dress_rentals')
            .update({ item_code: uniqueCode, updated_at: new Date().toISOString() })
            .eq('id', r.id);

          if (!updRentErr) {
            correctedRentals++;
            console.log(`${c.green}✔ Orden [${r.ticket_code}] corregida de "${r.item_code}" -> "${uniqueCode}" (${r.item_name})${c.reset}`);
          }
        }
      }
    }
    console.log(`${c.green}✔ ${correctedRentals} órdenes de alquiler sincronizadas con su código único exacto.${c.reset}\n`);
  }

  console.log(`${c.bold}${c.green}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.green}      RESTAURACIÓN COMPLETADA CON ÉXITO SIN AFECTAR IMÁGENES           ${c.reset}`);
  console.log(`${c.bold}${c.green}========================================================================${c.reset}\n`);
}

restoreUniqueCodes();
