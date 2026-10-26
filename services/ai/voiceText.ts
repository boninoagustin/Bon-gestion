/**
 * @fileoverview voiceText.ts — Normalización bidireccional de texto para el Modo Voz de BON.
 *
 * - `normalizeTranscript`: pre-procesa la transcripción del reconocimiento de voz (STT) antes de
 *   enviarla al LLM: convierte números dichos en palabras a dígitos ("cuarenta y cinco" → "45",
 *   "uno punto cero cinco cero" → "1.050", "mil cincuenta" → "1.050" en contexto de densidad) y
 *   corrige jerga cervecera mal transcripta ("o g" → "OG", "güirpul" → "whirlpool", etc.).
 * - `toSpeechText`: prepara la respuesta para el sintetizador (TTS): elimina markdown y emojis,
 *   pronuncia densidades ("1.052" → "uno cero 52"), decimales ("55.8" → "55 coma 8") y unidades.
 */

// ============================================================================
// 1. DICCIONARIO NUMÉRICO EN ESPAÑOL
// ============================================================================

type NumClass = 'unit' | 'teen' | 'ten' | 'hundred';

interface NumWord {
  value: number;
  cls: NumClass;
}

const NUM_WORDS: Record<string, NumWord> = {
  cero: { value: 0, cls: 'unit' },
  uno: { value: 1, cls: 'unit' },
  un: { value: 1, cls: 'unit' },
  una: { value: 1, cls: 'unit' },
  dos: { value: 2, cls: 'unit' },
  tres: { value: 3, cls: 'unit' },
  cuatro: { value: 4, cls: 'unit' },
  cinco: { value: 5, cls: 'unit' },
  seis: { value: 6, cls: 'unit' },
  siete: { value: 7, cls: 'unit' },
  ocho: { value: 8, cls: 'unit' },
  nueve: { value: 9, cls: 'unit' },
  diez: { value: 10, cls: 'teen' },
  once: { value: 11, cls: 'teen' },
  doce: { value: 12, cls: 'teen' },
  trece: { value: 13, cls: 'teen' },
  catorce: { value: 14, cls: 'teen' },
  quince: { value: 15, cls: 'teen' },
  dieciseis: { value: 16, cls: 'teen' },
  diecisiete: { value: 17, cls: 'teen' },
  dieciocho: { value: 18, cls: 'teen' },
  diecinueve: { value: 19, cls: 'teen' },
  veinte: { value: 20, cls: 'ten' },
  veintiun: { value: 21, cls: 'teen' },
  veintiuno: { value: 21, cls: 'teen' },
  veintiuna: { value: 21, cls: 'teen' },
  veintidos: { value: 22, cls: 'teen' },
  veintitres: { value: 23, cls: 'teen' },
  veinticuatro: { value: 24, cls: 'teen' },
  veinticinco: { value: 25, cls: 'teen' },
  veintiseis: { value: 26, cls: 'teen' },
  veintisiete: { value: 27, cls: 'teen' },
  veintiocho: { value: 28, cls: 'teen' },
  veintinueve: { value: 29, cls: 'teen' },
  treinta: { value: 30, cls: 'ten' },
  cuarenta: { value: 40, cls: 'ten' },
  cincuenta: { value: 50, cls: 'ten' },
  sesenta: { value: 60, cls: 'ten' },
  setenta: { value: 70, cls: 'ten' },
  ochenta: { value: 80, cls: 'ten' },
  noventa: { value: 90, cls: 'ten' },
  cien: { value: 100, cls: 'hundred' },
  ciento: { value: 100, cls: 'hundred' },
  doscientos: { value: 200, cls: 'hundred' },
  doscientas: { value: 200, cls: 'hundred' },
  trescientos: { value: 300, cls: 'hundred' },
  trescientas: { value: 300, cls: 'hundred' },
  cuatrocientos: { value: 400, cls: 'hundred' },
  cuatrocientas: { value: 400, cls: 'hundred' },
  quinientos: { value: 500, cls: 'hundred' },
  quinientas: { value: 500, cls: 'hundred' },
  seiscientos: { value: 600, cls: 'hundred' },
  seiscientas: { value: 600, cls: 'hundred' },
  setecientos: { value: 700, cls: 'hundred' },
  setecientas: { value: 700, cls: 'hundred' },
  ochocientos: { value: 800, cls: 'hundred' },
  ochocientas: { value: 800, cls: 'hundred' },
  novecientos: { value: 900, cls: 'hundred' },
  novecientas: { value: 900, cls: 'hundred' },
};

const stripAccents = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const keyOf = (token: string): string =>
  stripAccents(token.toLowerCase()).replace(/[.,;:!?¿¡"()]/g, '');

const DENSITY_CONTEXT = /\b(densidad|densidades|gravedad|og|fg|inicial|final|original|densimetro|hidrometro|sg)\b/;

// ============================================================================
// 2. CORRECCIÓN DE JERGA CERVECERA MAL TRANSCRIPTA
// ============================================================================

const JARGON_FIXES: [RegExp, string][] = [
  [/\b(?:o\s*g|o\s+ge|oyi|o\s+yi|ogé)\b/gi, 'OG'],
  [/\b(?:f\s*g|efe\s+ge|efe\s+g|efeyé)\b/gi, 'FG'],
  [/\b(?:a\s*b\s*v|a\s+be\s+ve)\b/gi, 'ABV'],
  [/\b(?:i\s*b\s*u|i\s+be\s+u)s?\b/gi, 'IBU'],
  [/\b(?:p\s*s\s*i|pe\s+ese\s+i)\b/gi, 'PSI'],
  [/\b(?:pe\s+hache|p\s*h)\b/gi, 'pH'],
  [/\b(?:g[üu]irl?\s*pul|huirl?\s*pul|wirl?\s*pul|wirlpool|whirl\s+pool)\b/gi, 'whirlpool'],
  [/\b(?:col|cold|kold)\s*(?:crash|crush|cras|crach)\b/gi, 'cold crash'],
  [/\b(?:drai|dray|drei)\s*(?:hop|jop|jo)\b|\bdraijop\b/gi, 'dry hop'],
  [/\b(?:bricks|brics|briks)\b/gi, 'Brix'],
  [/\b(?:estarter|estárter|starte)\b/gi, 'starter'],
  [/\b(?:spartch|esparch|espárch|esparge)\b/gi, 'sparge'],
  [/\b(?:centímetro|centimetro)\b/gi, 'centímetros'],
  [/\brefractometro\b/gi, 'refractómetro'],
  [/\bdensimetro\b/gi, 'densímetro'],
  [/\bhidrometro\b/gi, 'hidrómetro'],
];

// ============================================================================
// 3. CONVERSIÓN DE NÚMEROS EN PALABRAS A DÍGITOS
// ============================================================================

interface ParsedRun {
  /** Índice del primer token consumido */
  start: number;
  /** Índice siguiente al último token consumido */
  end: number;
  /** Representación numérica final (string para preservar ceros a la izquierda en decimales) */
  text: string;
  value: number;
}

/**
 * Intenta parsear una corrida de palabras numéricas a partir del token `i`.
 * Soporta: "cuarenta y cinco", "mil cincuenta", "doscientos cincuenta", "uno cero cinco cero"
 * (dictado dígito a dígito) y "cuatro y medio".
 */
function parseNumberRun(keys: string[], i: number): ParsedRun | null {
  if (!(keys[i] in NUM_WORDS) && keys[i] !== 'mil') return null;

  // Caso dictado dígito a dígito: 2+ unidades consecutivas (excepto "un/una")
  const digitSeq: number[] = [];
  let j = i;
  while (j < keys.length && NUM_WORDS[keys[j]]?.cls === 'unit' && keys[j] !== 'un' && keys[j] !== 'una') {
    digitSeq.push(NUM_WORDS[keys[j]].value);
    j++;
  }
  if (digitSeq.length >= 2) {
    const text = digitSeq.join('');
    return { start: i, end: j, text, value: Number(text) };
  }

  let total = 0;
  let current = 0;
  let last: NumClass | 'mil' | null = null;
  let consumedAny = false;
  j = i;

  while (j < keys.length) {
    const k = keys[j];

    if (k === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
      last = 'mil';
      consumedAny = true;
      j++;
      continue;
    }

    if (k === 'y') {
      // "y" solo une decenas con unidades ("cuarenta y cinco") o "y medio"
      const next = keys[j + 1];
      if (last === 'ten' && next && NUM_WORDS[next]?.cls === 'unit') {
        current += NUM_WORDS[next].value;
        last = 'unit';
        j += 2;
        continue;
      }
      break;
    }

    const w = NUM_WORDS[k];
    if (!w) break;

    // Transiciones válidas dentro de un grupo < 1000
    const valid =
      last === null ||
      last === 'mil' ||
      (last === 'hundred' && (w.cls === 'ten' || w.cls === 'teen' || w.cls === 'unit'));
    if (!valid) break;

    current += w.value;
    last = w.cls;
    consumedAny = true;
    j++;
  }

  if (!consumedAny) return null;

  let value = total + current;
  let text = String(value);

  // "y medio" / "y media"
  if (keys[j] === 'y' && (keys[j + 1] === 'medio' || keys[j + 1] === 'media')) {
    value += 0.5;
    text = String(value);
    j += 2;
  }

  return { start: i, end: j, text, value };
}

/**
 * Convierte números expresados en palabras dentro de una transcripción de voz a dígitos
 * y corrige jerga cervecera mal reconocida.
 *
 * @example
 * normalizeTranscript('densidad inicial mil cincuenta y final mil diez')
 * // → 'densidad inicial 1.050 y final 1.010'
 * normalizeTranscript('la olla mide cuarenta y cinco de diámetro')
 * // → 'la olla mide 45 de diámetro'
 */
export function normalizeTranscript(input: string): string {
  if (!input) return '';
  let text = input.replace(/\s+/g, ' ').trim();

  for (const [re, rep] of JARGON_FIXES) text = text.replace(re, rep);

  const tokens = text.split(' ');
  const keys = tokens.map(keyOf);
  const out: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const run = parseNumberRun(keys, i);
    if (!run) {
      out.push(tokens[i]);
      i++;
      continue;
    }

    // "uno"/"un"/"una" aislados se dejan como palabra ("uno de los tanques", "un barril")
    const isLoneOne =
      run.end - run.start === 1 && ['uno', 'un', 'una'].includes(keys[run.start]);

    let numberText = run.text;
    let end = run.end;

    // Decimales: "<n> punto|coma <m>"
    if ((keys[end] === 'punto' || keys[end] === 'coma') && end + 1 < keys.length) {
      const frac = parseNumberRun(keys, end + 1);
      if (frac) {
        numberText = `${run.text}.${frac.text}`;
        end = frac.end;
      }
    }

    if (isLoneOne && end === run.end) {
      out.push(tokens[i]);
      i++;
      continue;
    }

    // Densidad en puntos enteros ("mil cincuenta" → "1.050") según contexto previo
    if (!numberText.includes('.')) {
      const n = Number(numberText);
      if (n >= 980 && n <= 1200) {
        const context = keys.slice(Math.max(0, run.start - 6), run.start).join(' ');
        const lastGravityIdx = out.length > 0 ? out.join(' ').search(/\b1\.\d{3}\b/) : -1;
        if (DENSITY_CONTEXT.test(context) || lastGravityIdx >= 0) {
          numberText = (n / 1000).toFixed(3);
        }
      }
    }

    // Preservar puntuación final del último token consumido
    const trailing = tokens[end - 1].match(/[.,;:!?]+$/)?.[0] ?? '';
    out.push(numberText + trailing);
    i = end;
  }

  return out.join(' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}

// ============================================================================
// 4. PREPARACIÓN DE TEXTO PARA SÍNTESIS DE VOZ (TTS)
// ============================================================================

/**
 * Limpia markdown/emojis y adapta números, densidades y unidades para que el sintetizador
 * español los pronuncie de forma natural.
 *
 * @example
 * toSpeechText('Tenés **55.8 L** con OG 1.052 a 18°C')
 * // → 'Tenés 55 coma 8 litros con densidad inicial uno cero 52 a 18 grados'
 */
export function toSpeechText(input: string): string {
  if (!input) return '';
  let t = input;

  // Tags internos y markdown
  t = t.replace(/\[ABRIR_CALCULADORA:[\s\S]*?\]/g, '');
  t = t.replace(/\[GUARDAR_MEMORIA:[\s\S]*?\]/g, '');
  t = t.replace(/[*#_`•|>~]/g, ' ');
  t = t.replace(/^\s*[-–]\s+/gm, '');
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');

  // Siglas cerveceras
  t = t.replace(/\bOG\b/g, 'densidad inicial');
  t = t.replace(/\bFG\b/g, 'densidad final');
  t = t.replace(/\bABV\b/g, 'alcohol');
  t = t.replace(/\bIBUs?\b/g, 'I B U');
  t = t.replace(/\bSRM\b/g, 'S R M');
  t = t.replace(/\bPSI\b/gi, 'P S I');
  t = t.replace(/\bCO2\b|CO₂/g, 'C O 2');
  t = t.replace(/\bpH\b/g, 'pe hache');
  t = t.replace(/\bWCF\b/g, 'factor de corrección');
  t = t.replace(/\s*×\s*/g, ' por ');
  t = t.replace(/\s*≈\s*/g, ' aproximadamente ');

  // Densidades 1.0xx / 1.1xx (no montos de dinero ni miles con unidades)
  t = t.replace(
    /(^|[^$\d.,])1[.,]([01])(\d{2})(?![\d.,]|\s*(?:pesos|litros|L\b|kg|g\b))/g,
    (_m, pre: string, d1: string, rest: string) =>
      d1 === '0'
        ? `${pre}uno cero ${Number(rest)}`
        : `${pre}uno ${Number(`1${rest}`)}`
  );

  // Miles con punto: "45.000" → "45000"
  t = t.replace(/\b(\d{1,3})(?:\.(\d{3}))+\b(?![.,]\d)/g, (m) => m.replace(/\./g, ''));

  // Decimales con punto o coma: "55.8" / "55,8" → "55 coma 8"
  t = t.replace(/(\d+)[.,](\d+)/g, '$1 coma $2');

  // Unidades después de números
  t = t.replace(/(\d)\s*°\s*C\b/g, '$1 grados');
  t = t.replace(/(\d)\s*°\s*P\b/g, '$1 grados Plato');
  t = t.replace(/(\d)\s*°\s*Bx\b/gi, '$1 grados Brix');
  t = t.replace(/(\d)\s*°/g, '$1 grados');
  t = t.replace(/(\d)\s*%/g, '$1 por ciento');
  t = t.replace(/(\d)\s*L\/h\b/g, '$1 litros por hora');
  t = t.replace(/(\d)\s*L\/kg\b/g, '$1 litros por kilo');
  t = t.replace(/(\d)\s*g\/L\b/g, '$1 gramos por litro');
  t = t.replace(/(\d)\s*(?:L|lts?|litros?)\b/g, '$1 litros');
  t = t.replace(/(\d)\s*mL\b|(\d)\s*ml\b/g, (_m, a, b) => `${a ?? b} mililitros`);
  t = t.replace(/(\d)\s*cm\b/g, '$1 centímetros');
  t = t.replace(/(\d)\s*kg\b/g, '$1 kilos');
  t = t.replace(/(\d)\s*g\b/g, '$1 gramos');
  t = t.replace(/(\d)\s*bar\b/g, '$1 bar');
  t = t.replace(/(\d)\s*ppm\b/g, '$1 partes por millón');
  t = t.replace(/\$\s*(\d+)/g, '$1 pesos');

  // Paréntesis y espacios
  t = t.replace(/[()[\]{}]/g, ', ');
  t = t.replace(/\s*,\s*(,\s*)+/g, ', ');
  t = t.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  return t;
}

/**
 * Determina si la transcripción parcial termina en una palabra "puente" que indica que el
 * usuario todavía está dictando (para extender la ventana de silencio del micrófono).
 */
export function looksIncompleteUtterance(transcript: string): boolean {
  const k = keyOf(transcript.trim().split(/\s+/).pop() || '');
  return [
    'y', 'o', 'por', 'de', 'del', 'coma', 'punto', 'con', 'a', 'en', 'mil', 'es', 'son', 'mide', 'tiene', 'pero', 'para', 'si',
  ].includes(k) || /^(veinti|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)$/.test(k);
}
