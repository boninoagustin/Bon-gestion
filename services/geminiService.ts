/**
 * @fileoverview geminiService.ts — Orquestador Resiliente de Agente IA (Gemini + OpenAI IPC + Motor Local Offline)
 * para Bon-Gestión.
 *
 * Capacidades de resiliencia e ingeniería implementadas:
 * 1. Detección temprana de desconexión (`navigator.onLine === false`) y errores de red (`fetch`, `DNS`, `timeout`).
 * 2. Manejo inteligente de cuotas (`429 RESOURCE_EXHAUSTED`) con:
 *    - *Exponential Backoff + Jitter* para errores transitorios.
 *    - *Model Cascade Fallback* (`gemini-2.5-flash` → `gemini-2.0-flash`) cuando se agota el RPM de un modelo.
 *    - *Circuit Breaker* temporal con respuesta determinista local para no dejar al cervecero sin datos operativos.
 * 3. Inyección automática de diagnóstico de desvíos de fermentación (`diagnoseFermentationDeviations`)
 *    en el contexto de cada consulta.
 * 4. Motor determinista local (`buildOfflineOrFallbackResponse`) que resuelve directamente cálculos cerveceros
 *    usando `lib/brewmath.ts` (volumen de olla, temperatura de strike, volumen de sparge, carbonatación CO2 en PSI,
 *    ABV/atenuación, refractómetro, densímetro, acidificación y levadura), además de consultas de agenda,
 *    diagnóstico de fermentación, inventario, tanques, barriles y finanzas aun sin internet o sin API Key.
 */

import { GoogleGenAI } from '@google/genai';
import { BrewerySettings } from '../types';
import { useBreweryStore } from '../context/store';
import {
  buildContextPrompt,
  diagnoseFermentationDeviations,
  FermentationDiagnosticAlert,
  getSystemRules,
} from './ai/prompts';
import {
  aiTools,
  executeAbv,
  executeAcidAddition,
  executeCarbonation,
  executeHydrometerTempCorrection,
  executeKettleVolume,
  executePitchRateAndStarter,
  executeRefractometerCorrection,
  executeSpargeWater,
  executeStrikeWater,
  executeTool,
  WRITE_TOOLS,
} from './ai/tools';
import { tryOfflineCalculation } from './ai/calcTools';
import {
  CalculatorDeepLink,
  serializeCalculatorTag,
  stripCalculatorTags,
} from './ai/calculatorBridge';
import { normalizeTranscript } from './ai/voiceText';
import {
  calculateABV,
  calculateABVAdvanced,
  calculateAcidAddition,
  calculateCarbonationPressure,
  calculateKettleVolume,
  calculatePitchingRate,
  calculateSpargeVolumes,
  calculateStrikeTemp,
  correctGravity,
  correctRefractometerReading,
  sanitizeGravity,
} from '../lib/brewmath';

// ============================================================================
// 1. TIPOS ESTRICTOS DE MENSAJERÍA, PROVEEDORES Y CUOTAS
// ============================================================================

export interface AnalyzeOptions {
  isVoiceMode?: boolean;
}

export interface ChatHistoryMessage {
  role: 'user' | 'ai';
  content: string;
}

interface NormalizedChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: OpenAIToolCall[];
}

interface OpenAIToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

interface OpenAIIpcResponse {
  text?: string;
  error?: string;
  toolCalls?: OpenAIToolCall[];
}

interface ElectronApiWindow {
  electronAPI?: {
    askOpenAI?: (
      messages: NormalizedChatMessage[],
      settings: BrewerySettings | undefined,
      tools: unknown
    ) => Promise<OpenAIIpcResponse>;
  };
}

interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiContentPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

interface GeminiResponseShape {
  text?: string;
  functionCalls?: GeminiFunctionCall[];
}

interface QuotaBreakerState {
  blockedUntilMs: number;
  consecutiveRateLimits: number;
  lastErrorReason: string | null;
}

// ============================================================================
// 2. GESTIÓN DE CUOTAS (CIRCUIT BREAKER + EXPONENTIAL BACKOFF + MODEL CASCADE)
// ============================================================================

const GEMINI_MODEL_CASCADE = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;
const REQUEST_TIMEOUT_MS = 22000;
const MAX_TOOL_ITERATIONS = 5;

const quotaBreaker: QuotaBreakerState = {
  blockedUntilMs: 0,
  consecutiveRateLimits: 0,
  lastErrorReason: null,
};

/**
 * Verifica si el navegador o entorno Electron se encuentra sin conexión a internet.
 */
export function isClientOffline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return !navigator.onLine;
  }
  return false;
}

/**
 * Clasifica errores de red, autenticación y cuota de LLM.
 */
function classifyLlmError(error: unknown): {
  type: 'AUTH' | 'QUOTA' | 'TIMEOUT' | 'NETWORK' | 'SERVER' | 'UNKNOWN';
  retryable: boolean;
  retryDelayMs: number;
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('api_key') ||
    lower.includes('api key') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated')
  ) {
    return {
      type: 'AUTH',
      retryable: false,
      retryDelayMs: 0,
      message: raw,
    };
  }

  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    const retryMatch = raw.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i);
    const parsedDelayMs = retryMatch
    ? Math.min(30000, Math.ceil(Number(retryMatch[1]) * 1000))
    : 2000;
    return {
      type: 'QUOTA',
      retryable: true,
      retryDelayMs: parsedDelayMs,
      message: raw,
    };
  }

  if (lower.includes('timeout') || lower.includes('aborted')) {
    return {
      type: 'TIMEOUT',
      retryable: true,
      retryDelayMs: 1200,
      message: raw,
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('offline')
  ) {
    return {
      type: 'NETWORK',
      retryable: false,
      retryDelayMs: 0,
      message: raw,
    };
  }

  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('overloaded')
  ) {
    return {
      type: 'SERVER',
      retryable: true,
      retryDelayMs: 1500,
      message: raw,
    };
  }

  return {
    type: 'UNKNOWN',
    retryable: false,
    retryDelayMs: 0,
    message: raw,
  };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resuelve la API Key configurada por el usuario o expuesta de forma segura por Vite (`VITE_GEMINI_API_KEY`).
 */
function resolveGeminiApiKey(settings?: BrewerySettings): string {
  if (settings?.apiKey && settings.apiKey.trim().length > 0) {
    return settings.apiKey.trim();
  }
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string> })
    ?.env;
    if (viteEnv?.VITE_GEMINI_API_KEY) {
      return viteEnv.VITE_GEMINI_API_KEY.trim();
    }
  } catch {
    // Entorno sin import.meta
  }
  if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY.trim();
  }
  return '';
}

// ============================================================================
// 3. FORMATEADOR DE DIAGNÓSTICO DE FERMENTACIÓN EN TIEMPO REAL
// ============================================================================

function buildLiveDiagnosticContext(): {
  alerts: FermentationDiagnosticAlert[];
  summaryText: string;
} {
  const state = useBreweryStore.getState();
  const alerts = diagnoseFermentationDeviations(state.batches, state.fermenters);

  if (alerts.length === 0) {
    return {
      alerts: [],
      summaryText:
      'Sin desvíos críticos de fermentación detectados en los lotes activos.',
    };
  }

  const lines = alerts.map(
    (a) =>
    `- [${a.severity}] Lote ${a.lotCode} (${a.recipeName}${a.fermenterName ? ` en ${a.fermenterName}` : ''}): ${a.title}. Hallazgo: ${a.technicalFinding} Acción sugerida: ${a.recommendedAction}`
  );

  return {
    alerts,
    summaryText: lines.join('\n'),
  };
}

// ============================================================================
// 4. MOTOR DE FALLBACK OFFLINE Y DEGRADACIÓN GRACEFUL ANTE CORTE DE RED O CUOTA
// ============================================================================

/**
 * Parser determinista por regex/keywords en `geminiService.ts` que ejecuta directamente
 * las funciones matemáticas de `lib/brewmath.ts` cuando no hay conexión o la cuota está agotada.
 */
function parseDirectOfflineBrewMath(userQuery: string, isVoiceMode: boolean): string | null {
  if (!userQuery) return null;
  const normalized = normalizeTranscript(userQuery);
  const q = normalized
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

  const extractNum = (patterns: RegExp[]): number | undefined => {
    for (const re of patterns) {
      const m = q.match(re);
      if (m && m[1]) {
        const val = Number(m[1].replace(',', '.'));
        if (Number.isFinite(val)) return val;
      }
    }
    return undefined;
  };

  // A. Volumen de olla por geometría cilíndrica (`calculateKettleVolume`)
  if (/volumen.*olla|olla.*alto|olla.*diametro|olla.*volumen|litros.*olla|olla.*litros/.test(q)) {
    const diameter = extractNum([
      /(\d+(?:[.,]\d+)?)\s*(?:cm|centimetros?)?\s*(?:de\s+)?diametro/,
                                /diametro\s*(?:de\s+|:\s*|\s+)?(\d+(?:[.,]\d+)?)/,
    ]);
    const height = extractNum([
      /(\d+(?:[.,]\d+)?)\s*(?:cm|centimetros?)?\s*(?:de\s+)?(?:alto|altura|liquido)/,
                              /(?:alto|altura|liquido|profundidad)\s*(?:de\s+|:\s*|\s+)?(\d+(?:[.,]\d+)?)/,
    ]);

    if (diameter !== undefined && height !== undefined) {
      const volL = calculateKettleVolume(diameter, height);
      const res = executeKettleVolume({ diameterCm: diameter, liquidHeightCm: height });
      if (res.success && volL > 0) {
        if (isVoiceMode) {
          return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        }
        const tag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${tag}`;
      }
    }
    return 'Para calcularte el volumen exacto de la olla necesito dos datos: el diámetro interior en cm y la altura del líquido en cm. ¿Qué medidas tenés?';
  }

  // B. Carbonatación forzada en PSI / bar (`calculateCarbonationPressure`)
  if (/carbonat.*psi|psi.*temperatura|carbonat|psi|barril.*co2|presion.*co2/.test(q)) {
    const temp = extractNum([
      /(?:temp|temperatura|a)\s*(-?\d+(?:[.,]\d+)?)\s*(?:°|grados|c\b)/,
                            /(-?\d+(?:[.,]\d+)?)\s*(?:°\s*c|grados)/,
    ]);
    const vols = extractNum([
      /(\d+(?:[.,]\d+)?)\s*(?:vol|volumenes|vols)/,
                            /(?:volumenes|vols?)\s*(?:de\s+)?(\d+(?:[.,]\d+)?)/,
    ]);

    if (temp !== undefined && vols !== undefined) {
      const carb = calculateCarbonationPressure(temp, vols);
      const res = executeCarbonation({ beerTempC: temp, targetCO2Volumes: vols });
      if (res.success && carb.psi >= 0) {
        if (isVoiceMode) {
          return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        }
        const tag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${tag}`;
      }
    }
    return 'Para calcularte la presión de carbonatación en PSI necesito saber la temperatura de la cerveza en el barril (°C) y los volúmenes de CO2 objetivo. ¿Qué valores tenés?';
  }

  // C. Alcohol ABV y Atenuación (`calculateABV` / `calculateABVAdvanced`)
  if (/abv.*og.*fg|alcohol.*1\.\d{3}|\babv\b|alcohol|atenuacion/.test(q)) {
    const gravities = Array.from(q.matchAll(/\b(1[.,]\d{3}|\d{4})\b/g)).map((m) => {
      const n = Number(m[1].replace(',', '.'));
      return n >= 980 && n <= 1200 ? n / 1000 : n;
    });

    let og: number | undefined;
    let fg: number | undefined;
    if (gravities.length >= 2) {
      const sorted = [...gravities].sort((a, b) => b - a);
      og = sorted[0];
      fg = sorted[1];
    } else {
      const ogMatch = q.match(/(?:og|inicial|original)\D*(\d+(?:[.,]\d+)?)/);
      const fgMatch = q.match(/(?:fg|final)\D*(\d+(?:[.,]\d+)?)/);
      if (ogMatch) og = sanitizeGravity(ogMatch[1], 0);
      if (fgMatch) fg = sanitizeGravity(fgMatch[1], 0);
    }

    if (og && fg && og > fg) {
      const abvVal = calculateABV(og, fg);
      const advVal = calculateABVAdvanced(og, fg);
      const res = executeAbv({ og, fg });
      if (res.success && abvVal >= 0 && advVal.abv >= 0) {
        if (isVoiceMode) {
          return `${res.spokenSummary as string} (Calculado con motor local offline)`;
        }
        const tag = res.calculatorLinks?.[0] ? `\n\n${serializeCalculatorTag(res.calculatorLinks[0])}` : '';
        return `**${res.summary}**\n\n*(Calculado con motor local offline)*${tag}`;
      }
    }
    return 'Para calcular el porcentaje de alcohol (ABV) necesito la Densidad Original (OG) y la Densidad Final (FG). ¿Cuáles mediste?';
  }

  // D. Delegar resto de calculadoras de brewmath.ts (strike, sparge, refractómetro, densímetro, ácido, pitch)
  return tryOfflineCalculation(userQuery, isVoiceMode);
}

/**
 * Genera una respuesta operativa completa y precisa usando exclusivamente la base de datos local
 * y las funciones matemáticas puras de `lib/brewmath.ts` cuando el usuario no tiene conexión
 * a internet, se alcanzó el límite de cuota de la API o aún no configuró su API Key.
 */
export function buildOfflineOrFallbackResponse(
  userQuery: string,
  reason: 'OFFLINE' | 'QUOTA' | 'NO_API_KEY',
  isVoiceMode: boolean = false
): string {
  // 0. Parser determinista de cálculos con las funciones de lib/brewmath.ts
  const calcResult = parseDirectOfflineBrewMath(userQuery, isVoiceMode);
  if (calcResult) {
    return calcResult;
  }

  const q = userQuery.toLowerCase();
  const state = useBreweryStore.getState();
  const { alerts } = buildLiveDiagnosticContext();

  const statusBadge =
  reason === 'OFFLINE'
  ? '📡 *(Calculado con motor local offline — Sin conexión a internet)*'
  : reason === 'QUOTA'
  ? '⏳ *(Calculado con motor local offline — Cuota temporal de API agotada)*'
  : '💡 *(Calculado con motor local offline — Configurá tu API Key en Configuración ⚙️ para habilitar conversación libre con LLM)*';

  // Modo Voz: respuesta directa y hablada sin markdown
  if (isVoiceMode) {
    const briefing = executeTool('get_daily_briefing', {});
    const occupiedCount = Array.isArray(briefing.occupiedFermenters)
    ? briefing.occupiedFermenters.length
    : 0;
    const dirtyCount = Array.isArray(briefing.dirtyFermenters)
    ? briefing.dirtyFermenters.length
    : 0;
    const alertText =
    alerts.length > 0
    ? ` Atención: detecté ${alerts.length} desvío de fermentación en ${alerts[0].recipeName}.`
    : '';
    return `Estoy operando con el motor local offline. Tenés ${occupiedCount} fermentadores ocupados y ${dirtyCount} tanques sucios para limpieza.${alertText}`;
  }

  // 1. Consultas de diagnóstico de fermentación, calidad, atenuación, diacetilo o autólisis
  if (
    q.includes('fermentacion') ||
    q.includes('fermentación') ||
    q.includes('atenuacion') ||
    q.includes('atenuación') ||
    q.includes('diacetilo') ||
    q.includes('autolisis') ||
    q.includes('autólisis') ||
    q.includes('desvio') ||
    q.includes('desvío') ||
    q.includes('calidad') ||
    q.includes('off-flavor')
  ) {
    const out: string[] = [
      '### 🧪 Diagnóstico de Ingeniería de Fermentación (Motor Local)\n',
    ];
    if (alerts.length === 0) {
      out.push(
        '✅ **Todos los lotes en fermentación y maduración presentan parámetros dentro de rango normal** (sin indicios de estancamiento de atenuación, choque térmico, autólisis ni enfriamiento prematuro por diacetilo).\n'
      );
    } else {
      alerts.forEach((a) => {
        out.push(
          `- **[${a.severity}] ${a.recipeName} (${a.lotCode})${a.fermenterName ? ` — ${a.fermenterName}` : ''}:** ${a.title}`
        );
        out.push(`  - *Hallazgo técnico:* ${a.technicalFinding}`);
        out.push(`  - *Causas probables:* ${a.rootCauses.join(' ')}`);
        out.push(`  - *Acción recomendada:* **${a.recommendedAction}**\n`);
      });
    }
    out.push(statusBadge);
    return out.join('\n');
  }

  // 2. Consultas de fermentadores / tanques
  if (q.includes('fermentador') || q.includes('tanque')) {
    const fermRes = executeTool('get_fermenters_status', {});
    const out: string[] = ['### 🛢️ Estado de Fermentadores en Planta\n'];
    const list = Array.isArray(fermRes.fermenters) ? fermRes.fermenters : [];
    if (list.length > 0) {
      list.forEach((f: Record<string, unknown>) => {
        const cb = f.currentBatch as Record<string, unknown> | null;
        const batchInfo = cb
        ? ` → **Ocupado** con ${String(cb.recipeName)} (${String(cb.lotCode)}) — Día ${String(cb.daysInTank ?? '?')}, OG ${String(cb.originalGravity ?? '?')}${cb.lastGravity ? `, SG actual ${String(cb.lastGravity)}` : ''}${cb.lastTemperature !== undefined ? `, ${String(cb.lastTemperature)}°C` : ''}`
        : ` → Estado: **${String(f.status)}**`;
        out.push(`- **${String(f.name)}** (${String(f.capacity)}L)${batchInfo}`);
      });
      out.push(
        `\n**Capacidad instalada:** ${String(fermRes.available)} disponibles | ${String(fermRes.occupied)} ocupados | ${String(fermRes.dirty)} sucios para CIP | ${String(fermRes.maintenance)} en mantenimiento.`
      );
    } else {
      out.push('No hay fermentadores registrados en el sistema.');
    }
    out.push(`\n${statusBadge}`);
    return out.join('\n');
  }

  // 3. Consultas de stock / inventario / insumos / malta / lúpulo
  if (
    q.includes('stock') ||
    q.includes('inventario') ||
    q.includes('insumo') ||
    q.includes('malta') ||
    q.includes('lupulo') ||
    q.includes('lúpulo') ||
    q.includes('cocinar')
  ) {
    const invRes = executeTool('query_inventory', {});
    const items = Array.isArray(invRes.items)
    ? (invRes.items as Record<string, unknown>[])
    : [];
    const out: string[] = ['### 📦 Auditoría de Inventario e Insumos\n'];
    const outOfStock = items.filter((i) => i.status === 'OUT_OF_STOCK');
    const lowStock = items.filter((i) => i.status === 'LOW_STOCK');

    if (outOfStock.length > 0) {
      out.push(
        `- ❌ **Agotados (${outOfStock.length}):** ${outOfStock.map((i) => String(i.name)).join(', ')}`
      );
    }
    if (lowStock.length > 0) {
      out.push(
        `- ⚠️ **Stock crítico (${lowStock.length}):** ${lowStock.map((i) => `${String(i.name)} (${String(i.stockAmount)} ${String(i.unit)})`).join(', ')}`
      );
    }
    out.push(
      `- 💰 **Valorización total en depósito:** $${Number(invRes.totalInventoryValuation ?? 0).toLocaleString('es-AR')} (${items.length} ítems activos)`
    );
    out.push(`\n${statusBadge}`);
    return out.join('\n');
  }

  // 4. Consultas de finanzas / ventas / gastos / deudas
  if (
    q.includes('finanza') ||
    q.includes('venta') ||
    q.includes('gasto') ||
    q.includes('deuda') ||
    q.includes('margen') ||
    q.includes('cliente')
  ) {
    const fin = executeTool('get_financial_report', {});
    const out: string[] = [
      `### 💰 Resumen Financiero (${String(fin.month)})\n`,
      `- **Ingresos por ventas:** $${Number(fin.income ?? 0).toLocaleString('es-AR')}`,
      `- **Gastos operativos registrados:** $${Number(fin.expensesRegistered ?? 0).toLocaleString('es-AR')}`,
      `- **Resultado operativo antes de costos fijos:** $${Number(fin.resultBeforeFixed ?? 0).toLocaleString('es-AR')}`,
      `- **Costos fijos mensuales configurados:** $${Number(fin.fixedCostsConfiguredMonthly ?? 0).toLocaleString('es-AR')}`,
    ];
    const debtors = state.customers
    .filter((c) => c.debt > 0)
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 5);
    if (debtors.length > 0) {
      out.push(
        `\n**Principales cuentas por cobrar:**\n${debtors.map((c) => `- **${c.name}:** $${c.debt.toLocaleString('es-AR')}${c.contact ? ` (${c.contact})` : ''}`).join('\n')}`
      );
    }
    out.push(`\n${statusBadge}`);
    return out.join('\n');
  }

  // 5. Consultas de lotes activos
  if (q.includes('lote') || q.includes('produccion') || q.includes('producción')) {
    const batchesRes = executeTool('get_active_batches', {});
    const active = Array.isArray(batchesRes.activeBatches)
    ? (batchesRes.activeBatches as Record<string, unknown>[])
    : [];
    const out: string[] = ['### 🍺 Lotes Activos en Producción\n'];
    if (active.length > 0) {
      active.forEach((b) => {
        const ferm = b.fermenterName ? ` en **${String(b.fermenterName)}**` : '';
        const days =
        b.daysSinceBrew !== undefined ? ` (Día ${String(b.daysSinceBrew)})` : '';
      const grav = b.lastGravityReading
      ? ` | SG actual: ${String(b.lastGravityReading)}`
      : b.originalGravity
      ? ` | OG: ${String(b.originalGravity)}`
      : '';
      const temp =
      b.lastTemperatureReading !== undefined
      ? ` | Temp: ${String(b.lastTemperatureReading)}°C`
      : '';
      out.push(
        `- **${String(b.recipeName)}** [${String(b.lotCode)}] — **${String(b.status)}**${ferm}${days}${grav}${temp}`
      );
      });
    } else {
      out.push('No hay lotes activos en este momento.');
    }
    out.push(`\n${statusBadge}`);
    return out.join('\n');
  }

  // 6. Default: Briefing Operativo Completo del Día + Alertas de Fermentación
  const b = executeTool('get_daily_briefing', {});
  const out: string[] = ['### 📋 Resumen Operativo y de Ingeniería de Planta\n'];

  const eventsToday = Array.isArray(b.eventsToday)
  ? (b.eventsToday as Record<string, unknown>[])
  : [];
  if (eventsToday.length > 0) {
    out.push(
      `**📅 Agenda de Hoy:**\n${eventsToday.map((e) => `- ${String(e.title)}`).join('\n')}\n`
    );
  } else {
    out.push('**📅 Agenda de Hoy:** Sin eventos programados para hoy.\n');
  }

  if (alerts.length > 0) {
    out.push('**🧪 Alertas de Diagnóstico de Fermentación:**');
    alerts.forEach((a) => {
      out.push(
        `- **[${a.severity}] ${a.recipeName} (${a.lotCode}):** ${a.title} → *${a.recommendedAction}*`
      );
    });
    out.push('');
  }

  const dirtyF = Array.isArray(b.dirtyFermenters)
  ? (b.dirtyFermenters as Record<string, unknown>[])
  : [];
  const dirtyK = Array.isArray(b.dirtyKegs) ? (b.dirtyKegs as string[]) : [];
  if (dirtyF.length > 0 || dirtyK.length > 0) {
    out.push('**🧼 Limpieza y Sanitización (CIP):**');
    if (dirtyF.length > 0) {
      out.push(
        `- **Fermentadores para CIP:** ${dirtyF.map((f) => String(f.name)).join(', ')}`
      );
    }
    if (dirtyK.length > 0) {
      out.push(
        `- **Barriles sucios (${dirtyK.length}):** ${dirtyK.join(', ')}`
      );
    }
    out.push('');
  }

  const topDebtors = Array.isArray(b.topDebtors)
  ? (b.topDebtors as Record<string, unknown>[])
  : [];
  if (topDebtors.length > 0) {
    out.push('**💸 Cobranzas Prioritarias:**');
    topDebtors.forEach((c) => {
      out.push(
        `- **${String(c.name)}:** $${Number(c.debt ?? 0).toLocaleString('es-AR')}${c.contact ? ` (Tel: ${String(c.contact)})` : ''}`
      );
    });
    out.push('');
  }

  const outOfStock = Array.isArray(b.outOfStock)
  ? (b.outOfStock as string[])
  : [];
  const lowStock = Array.isArray(b.lowStock)
  ? (b.lowStock as Record<string, unknown>[])
  : [];
  if (outOfStock.length > 0 || lowStock.length > 0) {
    out.push('**📦 Alertas de Stock:**');
    if (outOfStock.length > 0) {
      out.push(`- **Sin stock:** ${outOfStock.join(', ')}`);
    }
    if (lowStock.length > 0) {
      out.push(
        `- **Stock bajo:** ${lowStock.map((i) => `${String(i.name)} (${String(i.stock)} ${String(i.unit)})`).join(', ')}`
      );
    }
    out.push('');
  }

  out.push(statusBadge);
  return out.join('\n');
}

// ============================================================================
// 5. INVOCACIÓN RESILIENTE A GEMINI CON RETRIES Y FALLBACK DE MODELO
// ============================================================================

async function callGeminiWithResilience(
  ai: GoogleGenAI,
  contents: GeminiContentTurn[],
  systemInstruction: string
): Promise<GeminiResponseShape> {
  let lastError: unknown;

  for (const modelName of GEMINI_MODEL_CASCADE) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT_MS);
        });

        const response = (await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: contents as unknown as Parameters<
            typeof ai.models.generateContent
            >[0]['contents'],
            config: {
              systemInstruction,
              tools: aiTools as unknown as NonNullable<
              Parameters<typeof ai.models.generateContent>[0]['config']
              >['tools'],
            },
          }),
          timeoutPromise,
        ])) as GeminiResponseShape;

        quotaBreaker.consecutiveRateLimits = 0;
        quotaBreaker.blockedUntilMs = 0;
        quotaBreaker.lastErrorReason = null;

        return response;
      } catch (err) {
        lastError = err;
        const classified = classifyLlmError(err);

        if (classified.type === 'AUTH' || classified.type === 'NETWORK') {
          throw err;
        }

        if (classified.type === 'QUOTA') {
          quotaBreaker.consecutiveRateLimits += 1;
          quotaBreaker.lastErrorReason = classified.message;
          if (attempt === 0) {
            const jitter = Math.floor(Math.random() * 400);
            await sleepMs(Math.min(2500, classified.retryDelayMs + jitter));
            continue;
          }
          break;
        }

        if (classified.retryable && attempt === 0) {
          const backoff = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
          await sleepMs(backoff);
          continue;
        }

        break;
      }
    }
  }

  throw lastError ?? new Error('No se pudo obtener respuesta del modelo.');
}

// ============================================================================
// 6. FUNCIÓN PRINCIPAL analyzeBrewingData
// ============================================================================

/**
 * Combina contexto multi-turno reciente cuando el usuario está respondiendo un slot-filling
 * en modo offline (ej. Turno 1: "calculame el volumen de la olla", Turno 2: "35 de diametro y 58 de alto").
 */
function buildEffectiveOfflineQuery(messagesHistory: ChatHistoryMessage[]): string {
  const lastUserMessage = messagesHistory[messagesHistory.length - 1]?.content || '';
  if (messagesHistory.length < 2) return lastUserMessage;

  const recentUserTurns = messagesHistory
  .slice(-4)
  .filter((m) => m.role === 'user')
  .map((m) => m.content);

  if (recentUserTurns.length >= 2 && lastUserMessage.trim().split(/\s+/).length <= 8) {
    return recentUserTurns.join(' ');
  }
  return lastUserMessage;
}

export const analyzeBrewingData = async (
  messagesHistory: ChatHistoryMessage[],
  appData: string,
  settings?: BrewerySettings,
  options: AnalyzeOptions = {}
): Promise<string> => {
  const isVoice = Boolean(options.isVoiceMode);
  const effectiveOfflineQuery = buildEffectiveOfflineQuery(messagesHistory);

  // 1. Fallback inmediato si el dispositivo no tiene conexión a internet
  if (isClientOffline()) {
    return buildOfflineOrFallbackResponse(effectiveOfflineQuery, 'OFFLINE', isVoice);
  }

  // 2. Verificar si el circuit breaker de cuota está activo
  if (Date.now() < quotaBreaker.blockedUntilMs) {
    return buildOfflineOrFallbackResponse(effectiveOfflineQuery, 'QUOTA', isVoice);
  }

  try {
    const systemRules = getSystemRules(
      settings?.aiPersonality || '',
      settings?.aiLongTermMemory || '',
      isVoice
    );

    const { summaryText: diagnosticSummary } = buildLiveDiagnosticContext();

    // Preparar historial normalizado limpiando tags internos de UI y preservando el hilo multi-turno
    const contents: NormalizedChatMessage[] = messagesHistory.map(
      (msg, index) => {
        let textToSend = stripCalculatorTags(msg.content || '');

        if (index === messagesHistory.length - 1 && msg.role === 'user') {
          const dateTimeStr = new Date().toLocaleString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          textToSend = buildContextPrompt(
            appData,
            textToSend,
            dateTimeStr,
            diagnosticSummary
          );
        }

        return {
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: String(textToSend),
        };
      }
    );

    const filteredContents = contents.filter(
      (c) =>
      !(
        c.role === 'assistant' &&
        c.content &&
        (c.content.includes('Soy BrewMaster AI') ||
        c.content.includes('Soy BON, tu asistente por voz') ||
        c.content.includes('Conversación reseteada'))
      )
    );

    const trimmedContents = filteredContents.slice(-20);

    // ------------------------------------------------------------------------
    // OPCIÓN 1: CHATGPT VÍA ELECTRON IPC
    // ------------------------------------------------------------------------
    if (settings?.aiProvider === 'chatgpt') {
      const win =
      typeof window !== 'undefined'
      ? (window as unknown as ElectronApiWindow)
      : undefined;
      if (win?.electronAPI?.askOpenAI) {
        const openAiMessages: NormalizedChatMessage[] = [
          { role: 'system', content: systemRules },
          ...trimmedContents,
        ];

        let loopCount = 0;
        let finalResponseText = '';
        const executedToolsLog: string[] = [];
        const executedCalculatorLinks: CalculatorDeepLink[] = [];

        while (loopCount < MAX_TOOL_ITERATIONS) {
          loopCount++;
          const response = await win.electronAPI.askOpenAI(
            openAiMessages,
            settings,
            aiTools[0]?.functionDeclarations
          );

          if (response?.error) {
            const classified = classifyLlmError(new Error(response.error));
            if (classified.type === 'NETWORK' || classified.type === 'QUOTA') {
              return buildOfflineOrFallbackResponse(
                effectiveOfflineQuery,
                classified.type === 'NETWORK' ? 'OFFLINE' : 'QUOTA',
                isVoice
              );
            }
            return `⚠️ Inconveniente con ChatGPT: ${response.error}\n\n💡 Podés cambiar al motor Google Gemini en Configuración (⚙️).`;
          }

          if (response?.toolCalls && response.toolCalls.length > 0) {
            const toolResultsForChat: {
              toolCallId: string;
              toolName: string;
              result: Record<string, unknown>;
            }[] = [];

            for (const call of response.toolCalls) {
              const res = executeTool(call.name, call.args);
              if (WRITE_TOOLS.has(call.name) && res?.success) {
                executedToolsLog.push(
                  typeof res.message === 'string' ? res.message : call.name
                );
              }
              if (Array.isArray(res?.calculatorLinks)) {
                for (const lk of res.calculatorLinks) {
                  if (lk && typeof lk === 'object') executedCalculatorLinks.push(lk as CalculatorDeepLink);
                }
              }
              const { calculatorLinks: _omitLinks, ...cleanRes } = res;
              toolResultsForChat.push({
                toolCallId: call.id || call.name,
                toolName: call.name,
                result: cleanRes,
              });
            }

            openAiMessages.push({
              role: 'assistant',
              content: response.text || '',
              toolCalls: response.toolCalls,
            });

            openAiMessages.push({
              role: 'tool',
              content: JSON.stringify(toolResultsForChat),
            });

            finalResponseText = response.text || '';
          } else {
            finalResponseText = response?.text || 'Acción completada.';
            break;
          }
        }

        if (executedToolsLog.length > 0 && !isVoice) {
          finalResponseText += `\n\n*(Acciones completadas: ${executedToolsLog.join(', ')})*`;
        }

        if (!isVoice && executedCalculatorLinks.length > 0) {
          for (const lk of executedCalculatorLinks) {
            const tag = serializeCalculatorTag(lk);
            if (!finalResponseText.includes(tag)) {
              finalResponseText += `\n\n${tag}`;
            }
          }
        }

        return finalResponseText;
      }

      return 'No estás ejecutando la versión de escritorio (Electron) para usar el puente IPC de ChatGPT. Cambiá a Google Gemini en Configuración (⚙️).';
    }

    // ------------------------------------------------------------------------
    // OPCIÓN 2: GOOGLE GEMINI CON MULTI-TOOL CALLING Y FALLBACK LOCAL
    // ------------------------------------------------------------------------
    const apiKey = resolveGeminiApiKey(settings);

    if (!apiKey) {
      return buildOfflineOrFallbackResponse(
        effectiveOfflineQuery,
        'NO_API_KEY',
        isVoice
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const currentContents: GeminiContentTurn[] = trimmedContents.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    let response = await callGeminiWithResilience(
      ai,
      currentContents,
      systemRules
    );

    let iterations = 0;
    const executedToolsLog: string[] = [];
    const executedCalculatorLinks: CalculatorDeepLink[] = [];

    while (
      response.functionCalls &&
      response.functionCalls.length > 0 &&
      iterations < MAX_TOOL_ITERATIONS
    ) {
      iterations++;
      const functionResponses: GeminiContentPart[] = [];
      const modelParts: GeminiContentPart[] = [];

      for (const call of response.functionCalls) {
        const result = executeTool(call.name, call.args);
        if (WRITE_TOOLS.has(call.name) && result?.success) {
          executedToolsLog.push(
            typeof result.message === 'string' ? result.message : call.name
          );
        }
        if (Array.isArray(result?.calculatorLinks)) {
          for (const lk of result.calculatorLinks) {
            if (lk && typeof lk === 'object') executedCalculatorLinks.push(lk as CalculatorDeepLink);
          }
        }
        const { calculatorLinks: _omitLinks, ...cleanResult } = result;
        modelParts.push({
          functionCall: { name: call.name, args: call.args },
        });
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: cleanResult,
          },
        });
      }

      currentContents.push({
        role: 'model',
        parts: modelParts,
      });

      currentContents.push({
        role: 'user',
        parts: functionResponses,
      });

      response = await callGeminiWithResilience(
        ai,
        currentContents,
        systemRules
      );
    }

    let finalText = response?.text || 'Acción completada.';
    if (executedToolsLog.length > 0 && !isVoice && !response?.text) {
      finalText = `✅ Acciones ejecutadas: ${executedToolsLog.join(' | ')}`;
    }

    if (!isVoice && executedCalculatorLinks.length > 0) {
      for (const lk of executedCalculatorLinks) {
        const tag = serializeCalculatorTag(lk);
        if (!finalText.includes(tag)) {
          finalText += `\n\n${tag}`;
        }
      }
    }

    return finalText;
  } catch (error) {
    console.error('[geminiService] Error procesando consulta IA:', error);
    const classified = classifyLlmError(error);

    if (classified.type === 'AUTH') {
      return '🔑 **Error de autenticación:** La API Key de Google Gemini no es válida o fue revocada. Verificala en Configuración (⚙️).';
    }

    if (classified.type === 'QUOTA') {
      quotaBreaker.blockedUntilMs = Date.now() + 25000;
      return buildOfflineOrFallbackResponse(effectiveOfflineQuery, 'QUOTA', isVoice);
    }

    if (classified.type === 'NETWORK' || classified.type === 'TIMEOUT' || isClientOffline()) {
      return buildOfflineOrFallbackResponse(
        effectiveOfflineQuery,
        'OFFLINE',
        isVoice
      );
    }

    return buildOfflineOrFallbackResponse(effectiveOfflineQuery, 'OFFLINE', isVoice);
  }
};
