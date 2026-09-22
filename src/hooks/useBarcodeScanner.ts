import { useEffect, useRef, useCallback } from 'react';

export interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxIntervalMs?: number;
}

/**
 * Hook para interceptar lecturas de escáneres de código de barras (emuladores de teclado USB/Bluetooth).
 * Los escáneres escriben una ráfaga rápida de caracteres (<45ms por tecla) seguida de Enter.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 3,
  maxIntervalMs = 50,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      // Si se presiona Enter, evaluar si acumulamos un código válido por escáner
      if (e.key === 'Enter') {
        const buffer = bufferRef.current.trim();
        // Verificamos si tiene la longitud mínima requerida
        if (buffer.length >= minLength) {
          // Si la ráfaga fue rápida o acumuló un código de barras
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(buffer);
        }
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;
        return;
      }

      // Descartar teclas especiales que no formen parte de códigos de barras (Ctrl, Alt, Shift, Escape, etc.)
      if (e.key.length !== 1) {
        return;
      }

      // Si pasó demasiado tiempo entre teclas (> 150ms), reiniciar buffer (escritura humana manual dispersa)
      if (timeDiff > 150 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      bufferRef.current += e.key;
      lastKeyTimeRef.current = now;
    },
    [enabled, minLength, maxIntervalMs]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);
}
