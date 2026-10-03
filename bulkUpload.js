import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Bypass de Seguridad / Inicialización de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydvqzgyhymjgbyfkxqhd.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31m[ERROR FATAL] No se encontraron credenciales de Supabase en el archivo .env/.env.local\x1b[0m');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// Colores de consola ANSI
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

const BUCKET_NAME = 'wardrobe-images';
const MASTER_FOLDER = path.join(__dirname, 'IMAGENESvestido');

/**
 * Función ultra-resiliente para localizar la fotografía correspondiente
 * manejando extensiones alternas (.webp, .png, .jpg), mayúsculas/minúsculas y subcarpetas de talla.
 */
function resolveImageFile(folderPath, rawRelPath) {
  if (!rawRelPath) return null;
  const cleanRel = rawRelPath.replace(/\\/g, '/').trim();

  // 1. Ruta directa desde MASTER_FOLDER
  const fromMaster = path.join(MASTER_FOLDER, cleanRel);
  if (fs.existsSync(fromMaster) && fs.statSync(fromMaster).isFile()) return fromMaster;

  // 2. Ruta directa desde la subcarpeta específica (ej. IMAGENESvestido/A)
  const fromFolder = path.join(folderPath, cleanRel);
  if (fs.existsSync(fromFolder) && fs.statSync(fromFolder).isFile()) return fromFolder;

  // 3. Solo el nombre de archivo en la subcarpeta
  const filename = path.basename(cleanRel);
  const directInFolder = path.join(folderPath, filename);
  if (fs.existsSync(directInFolder) && fs.statSync(directInFolder).isFile()) return directInFolder;

  // 4. Intentar con extensiones alternativas (.webp, .png, .jpg, .jpeg)
  const dirOfClean = path.dirname(fromMaster);
  const nameNoExt = path.parse(filename).name;

  const testDirs = [folderPath, dirOfClean];
  for (const d of testDirs) {
    if (fs.existsSync(d)) {
      for (const ext of ['.webp', '.png', '.jpg', '.jpeg', '.JPG', '.PNG', '.WEBP']) {
        const candidate = path.join(d, nameNoExt + ext);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      }
    }
  }

  // 5. Búsqueda recursiva en la subcarpeta ignorando mayúsculas y extensión
  const targetLower = nameNoExt.toLowerCase();
  function searchRecursive(dir) {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const match = searchRecursive(full);
        if (match) return match;
      } else if (ent.isFile() && !ent.name.endsWith('.json')) {
        if (path.parse(ent.name).name.toLowerCase() === targetLower) {
          return full;
        }
      }
    }
    return null;
  }

  return searchRecursive(folderPath);
}

/**
 * Determina el Content-Type para Supabase Storage
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

/**
 * Deduce la talla si está presente en la ruta o nombre
 */
function inferSize(rawPath, itemName) {
  const text = `${rawPath || ''} ${itemName || ''}`.toUpperCase();
  if (text.includes('TALLA XS') || text.includes(' XS')) return 'XS';
  if (text.includes('TALLA XL') || text.includes(' XL')) return 'XL';
  if (text.includes('TALLA S') || text.includes(' S')) return 'S';
  if (text.includes('TALLA L') || text.includes(' L')) return 'L';
  if (text.includes('TALLA M') || text.includes(' M')) return 'M';
  return 'M';
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}    SUBIDA MASIVA AUTOMATIZADA DE PRENDAS DE BOUTIQUE A SUPABASE       ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);

  console.log(`${c.yellow}[INFO] Supabase URL:${c.reset} ${supabaseUrl}`);
  console.log(`${c.yellow}[INFO] Bucket Destino:${c.reset} ${BUCKET_NAME}`);
  console.log(`${c.yellow}[INFO] Directorio Local:${c.reset} ${MASTER_FOLDER}\n`);

  if (!fs.existsSync(MASTER_FOLDER)) {
    console.error(`\x1b[31m[ERROR] No se encontró el directorio maestro: ${MASTER_FOLDER}\x1b[0m`);
    process.exit(1);
  }

  // Cargar ítems ya existentes en la BD para evitar duplicados y actualizar limpiamente
  console.log(`${c.cyan}[INFO] Consultando registros existentes en la tabla 'wardrobe_items'...${c.reset}`);
  const { data: existingRows, error: errExisting } = await supabase
    .from('wardrobe_items')
    .select('id, code, codigo_prenda');

  const existingMap = new Map();
  if (!errExisting && existingRows) {
    for (const row of existingRows) {
      const codeKey = (row.codigo_prenda || row.code || '').trim().toUpperCase();
      if (codeKey) existingMap.set(codeKey, row.id);
    }
  }
  console.log(`${c.green}[INFO] ${existingMap.size} prendas existentes ya registradas en BD.${c.reset}\n`);

  // Escanear carpetas de la A a la Y
  const subfolders = fs
    .readdirSync(MASTER_FOLDER)
    .filter((f) => fs.statSync(path.join(MASTER_FOLDER, f)).isDirectory())
    .sort();

  console.log(`${c.cyan}[INFO] Se encontraron ${subfolders.length} subcarpetas a procesar: [${subfolders.join(', ')}]${c.reset}\n`);

  const stats = {
    totalScanned: 0,
    uploaded: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
  };

  const startTime = Date.now();

  for (const folderName of subfolders) {
    const folderPath = path.join(MASTER_FOLDER, folderName);
    const files = fs.readdirSync(folderPath);
    const jsonFile = files.find((f) => f.toLowerCase().endsWith('.json'));

    if (!jsonFile) {
      console.log(`${c.yellow}[SKIP] Carpeta '${folderName}': No contiene archivo .json${c.reset}`);
      continue;
    }

    const jsonPath = path.join(folderPath, jsonFile);
    let items = [];
    try {
      const rawContent = fs.readFileSync(jsonPath, 'utf8');
      items = JSON.parse(rawContent);
    } catch (e) {
      console.error(`${c.red}[ERROR] Carpeta '${folderName}': Fallo al parsear JSON (${jsonFile}): ${e.message}${c.reset}`);
      continue;
    }

    console.log(`\n${c.bold}${c.magenta}📁 PROCESANDO CARPETA: [${folderName}] (${items.length} prendas registradas en ${jsonFile})${c.reset}`);

    // Procesar prendas de esta carpeta en lotes de concurrencia controlada (3 simultáneos para máxima velocidad y seguridad)
    const BATCH_SIZE = 3;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (item, idx) => {
          const itemIndex = i + idx + 1;
          const codigo = (item.codigo || `${folderName}-${itemIndex}`).trim();
          stats.totalScanned++;

          try {
            // 1. Localizar archivo de imagen
            const localImagePath = resolveImageFile(folderPath, item.ruta_imagen);
            if (!localImagePath) {
              console.error(
                `${c.red}❌ [${codigo}] FOTO NO ENCONTRADA: ${item.ruta_imagen || '(sin ruta)'} en carpeta ${folderName}${c.reset}`
              );
              stats.failed++;
              return;
            }

            // 2. Leer archivo y preparar subida
            const fileBuffer = await fs.promises.readFile(localImagePath);
            const fileExt = path.extname(localImagePath).toLowerCase() || '.webp';
            const mimeType = getMimeType(localImagePath);
            const cleanCodeSafe = codigo.replace(/[^a-zA-Z0-9_-]/g, '_');
            const storageFilename = `${cleanCodeSafe}-${Date.now()}-${Math.floor(Math.random() * 1000)}${fileExt}`;

            // 3. Subir al Bucket de Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(storageFilename, fileBuffer, {
                contentType: mimeType,
                upsert: true,
              });

            if (uploadError) {
              console.error(
                `${c.red}❌ [${codigo}] ERROR SUBIDA STORAGE: ${uploadError.message}${c.reset}`
              );
              stats.failed++;
              return;
            }

            stats.uploaded++;

            // 4. Obtener URL pública permanente
            const { data: pubData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(uploadData.path || storageFilename);

            const publicUrl = pubData.publicUrl;

            // 5. Preparar Payload para Base de Datos
            const precioNumeric = typeof item.precio === 'number' ? item.precio : parseFloat(item.precio) || 0;
            const priceCents = Math.round(precioNumeric * 100);
            const inferredSize = inferSize(item.ruta_imagen, item.titulo);

            const dbPayload = {
              // Campos solicitados explícitamente en el prompt
              titulo: item.titulo || `Vestido ${codigo}`,
              descripcion: item.descripcion || '',
              categoria_evento: item.categoria || 'Gala & Noche',
              codigo_prenda: codigo,
              precio_alquiler: precioNumeric,
              garantia_reembolsable: 50,
              imagen_url: publicUrl,
              estado: true,

              // Columnas nativas de la aplicación para catálogo público y POS
              name: item.titulo || `Vestido ${codigo}`,
              description: item.descripcion || '',
              category: item.categoria || 'Gala & Noche',
              code: codigo,
              price_cents: priceCents,
              deposit_cents: 0,
              guarantee_cents: 5000, // S/ 50.00 en céntimos
              availability_status: 'disponible',
              is_active: true,
              images: [publicUrl],
              size: inferredSize,
              color: 'Variado',
              updated_at: new Date().toISOString(),
            };

            // 6. Inserción o actualización segura
            const existingId = existingMap.get(codigo.toUpperCase());
            if (existingId) {
              const { error: updateErr } = await supabase
                .from('wardrobe_items')
                .update(dbPayload)
                .eq('id', existingId);

              if (updateErr) {
                console.error(`${c.red}❌ [${codigo}] ERROR UPDATE BD: ${updateErr.message}${c.reset}`);
                stats.failed++;
              } else {
                stats.updated++;
                console.log(
                  `${c.green}✔ [${codigo}] ACTUALIZADO${c.reset} - ${dbPayload.titulo.substring(0, 45)}... [${path.basename(localImagePath)}]`
                );
              }
            } else {
              const { data: insertData, error: insertErr } = await supabase
                .from('wardrobe_items')
                .insert(dbPayload)
                .select('id')
                .single();

              if (insertErr) {
                console.error(`${c.red}❌ [${codigo}] ERROR INSERT BD: ${insertErr.message}${c.reset}`);
                stats.failed++;
              } else {
                if (insertData?.id) existingMap.set(codigo.toUpperCase(), insertData.id);
                stats.inserted++;
                console.log(
                  `${c.green}✔ [${codigo}] INSERTADO EXITOSO${c.reset} - ${dbPayload.titulo.substring(0, 45)}... [${path.basename(localImagePath)}]`
                );
              }
            }
          } catch (itemErr) {
            console.error(
              `${c.red}❌ [${codigo}] EXCEPCIÓN NO CONTROLADA: ${itemErr.message || itemErr}${c.reset}`
            );
            stats.failed++;
          }
        })
      );
    }
  }

  const elapsedSecs = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.green}                    RESUMEN DE SUBIDA MASIVA FINALIZADA                ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}Total prendas escaneadas:${c.reset}     ${stats.totalScanned}`);
  console.log(`${c.bold}Imágenes subidas a Storage:${c.reset}   ${c.green}${stats.uploaded}${c.reset}`);
  console.log(`${c.bold}Registros insertados en BD:${c.reset}   ${c.green}${stats.inserted}${c.reset}`);
  console.log(`${c.bold}Registros actualizados en BD:${c.reset} ${c.yellow}${stats.updated}${c.reset}`);
  console.log(`${c.bold}Errores/fallas:${c.reset}               ${stats.failed > 0 ? c.red : c.green}${stats.failed}${c.reset}`);
  console.log(`${c.bold}Tiempo total transcurrido:${c.reset}    ${elapsedSecs} segundos`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);
}

main().catch((err) => {
  console.error('\x1b[31m[ERROR CRÍTICO EN SCRIPT]:\x1b[0m', err);
  process.exit(1);
});
