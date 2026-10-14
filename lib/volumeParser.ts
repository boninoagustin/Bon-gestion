/**
 * VolumeParser — Conversión unificada de formato de venta a litros.
 *
 * Esta función reemplaza las dos versiones duplicadas que existían en:
 * - SalesHistory.tsx (L15-38)
 * - Dashboard.tsx (L385-403)
 *
 * Ahora es la fuente única de verdad para calcular litros vendidos.
 */

/**
 * Parsea un string de formato de venta y devuelve el volumen en litros por unidad.
 *
 * Soporta formatos como:
 * - "500ml", "330cc", "1000ml" → mililitros a litros
 * - "1L", "2 litros", "1.5lt" → litros directos
 * - "Pinta" → 0.5L
 * - "Growler" → 1.9L
 * - "Lata" → 0.473L
 * - "Botella 730" → 0.73L
 * - "Barril 20/30/50" → 20/30/50L
 *
 * @param format - String descriptivo del formato (ej. "Pinta 500ml")
 * @returns Volumen en litros por unidad (0 si no se puede determinar)
 */
export function parseVolumeFromFormat(format: string): number {
  if (!format) return 0;
  const n = format.toLowerCase().trim();

  // 1. Explicit ml/cc values
  const mlMatch = n.match(/(\d+(?:\.\d+)?)\s*(?:ml|cc|cm3|cm\^3|mililitros?)\b/i);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1]);
    return Number.isFinite(val) ? val / 1000 : 0;
  }

  // 2. Explicit liter values
  const lMatch = n.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|lts|litros?)\b/i);
  if (lMatch) {
    const val = parseFloat(lMatch[1]);
    return Number.isFinite(val) ? val : 0;
  }

  // 3. Named formats
  if (n.includes('media pinta') || n.includes('media-pinta')) return 0.33;
  if (n.includes('growler')) return 1.9;
  if (n.includes('pinta')) return 0.5;
  if (n.includes('lata')) return 0.473;
  if (n.includes('litro')) return 1.0;
  if (n.includes('media')) return 0.5;

  // 4. Barrel sizes
  if (n.includes('barril')) {
    if (n.includes('50')) return 50;
    if (n.includes('30')) return 30;
    if (n.includes('20')) return 20;
    return 20; // Default barrel size
  }

  // 5. Bottle with numeric size
  if (n.includes('botella') || n.includes('vaso')) {
    if (n.includes('1000')) return 1.0;
    if (n.includes('730')) return 0.73;
    if (n.includes('500')) return 0.5;
    if (n.includes('330')) return 0.33;
    if (n.includes('1')) return 1.0;
  }

  return 0;
}

/**
 * Calcula el volumen total en litros para una venta.
 * @param format - String del formato de venta
 * @param quantity - Cantidad de unidades
 * @returns Volumen total en litros
 */
export function calculateSaleVolume(format: string, quantity: number): number {
  return parseVolumeFromFormat(format) * quantity;
}
