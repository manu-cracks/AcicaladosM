import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

/**
 * Route Handler middleware para procesar el intercambio de código OAuth de Supabase
 * utilizando @supabase/ssr y persistir la sesión segura en cookies HTTP.
 */
function supabaseAuthCallbackPlugin(env: Record<string, string>) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return {
    name: 'supabase-auth-callback-handler',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/auth/callback')) {
          try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
            const code = url.searchParams.get('code');
            const nextParam = url.searchParams.get('next');

            if (code) {
              if (!supabaseUrl || !supabaseAnonKey) {
                console.warn('[Vite Auth Handler] Variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no configuradas.');
                next();
                return;
              }

              const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
                cookies: {
                  getAll() {
                    return parseCookieHeader(req.headers.cookie ?? '');
                  },
                  setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                      res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options));
                    });
                  },
                },
              });

              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error && data?.user) {
                // Consultar rol en la tabla profiles de Supabase
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('role')
                  .eq('id', data.user.id)
                  .single();

                const role = profile?.role || 'cliente';
                const redirectTarget =
                  role === 'admin' || role === 'recepcionista' ? '/dashboard' : nextParam || '/mi-cuenta';

                res.statusCode = 302;
                res.setHeader('Location', redirectTarget);
                res.end();
                return;
              }
            }
          } catch (err) {
            console.error('Error en Route Handler /auth/callback:', err);
          }
        }
        next();
      });
    },
  };
}

/**
 * Middleware para procesar la consulta segura de DNI mediante APIS PERU
 * en el servidor de desarrollo de Vite sin exponer el token al cliente.
 */
function apisPeruDniPlugin(env: Record<string, string>) {
  const token = env.APIS_PERU_TOKEN || process.env.APIS_PERU_TOKEN || '';

  return {
    name: 'apis-peru-dni-handler',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/consulta-dni')) {
          try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
            const dni = url.searchParams.get('dni')?.trim() || '';

            res.setHeader('Content-Type', 'application/json');

            if (!/^\d{8}$/.test(dni)) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  success: false,
                  message: 'El DNI debe contener exactamente 8 dígitos numéricos.',
                })
              );
              return;
            }

            if (!token) {
              console.warn('[Vite DNI Handler] APIS_PERU_TOKEN no configurado en .env.local.');
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  success: false,
                  message: 'Token de consulta no configurado en el servidor.',
                })
              );
              return;
            }

            const response = await fetch(`https://dniruc.apisperu.com/api/v1/dni/${dni}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });

            if (!response.ok) {
              res.statusCode = response.status >= 500 ? 502 : 404;
              res.end(
                JSON.stringify({
                  success: false,
                  message: 'DNI no encontrado o error en el servicio de consulta.',
                })
              );
              return;
            }

            const data: any = await response.json();

            if (!data || data.success === false || !data.nombres) {
              res.statusCode = 404;
              res.end(
                JSON.stringify({
                  success: false,
                  message: data?.message || 'DNI no encontrado',
                })
              );
              return;
            }

            const apellidos = `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                dni: data.dni || dni,
                nombres: (data.nombres || '').trim(),
                apellidos: apellidos,
              })
            );
            return;
          } catch (err: any) {
            console.error('Error en Vite Handler /api/consulta-dni:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'Error interno al consultar el DNI' }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), supabaseAuthCallbackPlugin(env), apisPeruDniPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              usePolling: true,
              interval: 1000,
            },
    },
  };
});
