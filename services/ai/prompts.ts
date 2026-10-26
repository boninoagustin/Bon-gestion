/**
 * @fileoverview prompts.ts — Definición del Agente de Ingeniería Cervecera y Operaciones (Brewery Operations Lead)
 * y motor determinista de diagnóstico de desvíos de fermentación para Bon-Gestión.
 */

import { Batch, BatchStatus, Fermenter } from '../../types';
import { calculateAttenuation, sgToPlato } from '../../lib/brewmath';

// ============================================================================
// 1. TIPOS DE DIAGNÓSTICO DE INGENIERÍA DE FERMENTACIÓN
// ============================================================================

export type FermentationDeviationType =
  | 'LOW_ATTENUATION'
  | 'ABNORMAL_TEMPERATURE'
  | 'AUTOLYSIS_RISK'
  | 'DIACETYL_RISK';

export type DeviationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface FermentationDiagnosticAlert {
  batchId: string;
  lotCode: string;
  recipeName: string;
  fermenterName?: string;
  type: FermentationDeviationType;
  severity: DeviationSeverity;
  title: string;
  technicalFinding: string;
  rootCauses: string[];
  recommendedAction: string;
}

// ============================================================================
// 2. MOTOR DE DIAGNÓSTICO DE DESVÍOS DE FERMENTACIÓN (TIEMPO REAL + OFFLINE)
// ============================================================================

/**
 * Analiza todos los lotes activos en fermentación o maduración para detectar
 * desvíos físico-químicos y microbiológicos:
 * 1. Atenuación baja o fermentación estancada (Stuck Fermentation).
 * 2. Perfiles de temperatura anormales (exotermia de ésteres/fusel o choque térmico).
 * 3. Riesgo de autólisis celular por tiempo prolongado sobre levadura sin purga.
 * 4. Riesgo de diacetilo (VDK / 2,3-butanodiona) por enfriamiento prematuro o falta de descanso.
 *
 * @param batches - Lista de lotes de la planta.
 * @param fermenters - Lista de fermentadores de la planta.
 * @param referenceDateIso - Fecha de referencia ISO (default: hoy).
 * @returns Lista estructurada de alertas de diagnóstico `FermentationDiagnosticAlert[]`.
 */
export function diagnoseFermentationDeviations(
  batches: Batch[],
  fermenters: Fermenter[] = [],
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): FermentationDiagnosticAlert[] {
  const alerts: FermentationDiagnosticAlert[] = [];
  const refTime = new Date(`${referenceDateIso.slice(0, 10)}T12:00:00`).getTime();

  const activeBatches = (batches || []).filter(
    (b) =>
      b.status === BatchStatus.FERMENTING ||
      b.status === BatchStatus.CONDITIONING
  );

  for (const batch of activeBatches) {
    const logs = [...(batch.fermentationLogs || [])].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );

    const brewTime = batch.brewDate
      ? new Date(`${batch.brewDate.slice(0, 10)}T12:00:00`).getTime()
      : refTime;
    const daysSinceBrew = Math.max(
      0,
      Math.round((refTime - brewTime) / 86400000)
    );

    const fermenterName =
      batch.fermenterName ||
      (batch.fermenterId
        ? fermenters.find((f) => f.id === batch.fermenterId)?.name
        : undefined);

    const gravityLogs = logs.filter(
      (l) => typeof l.gravity === 'number' && Number.isFinite(l.gravity)
    );
    const tempLogs = logs.filter(
      (l) => typeof l.temperature === 'number' && Number.isFinite(l.temperature)
    );

    const og = batch.originalGravity || 1.05;
    const lastGravity =
      gravityLogs.length > 0
        ? (gravityLogs[gravityLogs.length - 1].gravity as number)
        : undefined;
    const lastTemp =
      tempLogs.length > 0
        ? (tempLogs[tempLogs.length - 1].temperature as number)
        : undefined;

    const currentAttenuation =
      lastGravity !== undefined ? calculateAttenuation(og, lastGravity) : null;

    const isLager = /lager|pils|bock|helles|marzen/i.test(
      `${batch.style || ''} ${batch.recipeName || ''}`
    );

    // ------------------------------------------------------------------------
    // A. Diagnóstico de Atenuación Baja / Fermentación Estancada
    // ------------------------------------------------------------------------
    if (
      currentAttenuation !== null &&
      daysSinceBrew >= 6 &&
      currentAttenuation < 65
    ) {
      alerts.push({
        batchId: batch.id,
        lotCode: batch.lotCode,
        recipeName: batch.recipeName,
        fermenterName,
        type: 'LOW_ATTENUATION',
        severity: daysSinceBrew >= 9 ? 'CRITICAL' : 'WARNING',
        title: `Atenuación aparente baja (${currentAttenuation.toFixed(1)}%) en día ${daysSinceBrew}`,
        technicalFinding: `El lote ${batch.lotCode} (${batch.recipeName}) presenta OG ${og.toFixed(3)} (${sgToPlato(og).toFixed(1)} °P) y densidad actual ${lastGravity?.toFixed(3)} tras ${daysSinceBrew} días (atenuación ${currentAttenuation.toFixed(1)}% < 65% esperado).`,
        rootCauses: [
          'Temperatura de maceración alta (>68°C) con exceso de dextrinas límite.',
          'Sub-inoculación (underpitching) o baja viabilidad celular inicial.',
          'Choque térmico por descenso brusco de temperatura o falta de oxígeno/nutrientes (Zn²⁺).',
          'Lectura tomada con refractómetro sin corrección por alcohol (ecuación de Terrill/Novotny).',
        ],
        recommendedAction:
          'Verificar si la medición fue con densímetro o refractómetro corregido; elevar setpoint térmico +1.5°C y resuspender levadura suavemente desde el cono sin introducir oxígeno.',
      });
    } else if (gravityLogs.length >= 2 && daysSinceBrew >= 4 && currentAttenuation !== null && currentAttenuation < 70) {
      const prevG = gravityLogs[gravityLogs.length - 2].gravity as number;
      const currG = gravityLogs[gravityLogs.length - 1].gravity as number;
      if (Math.abs(prevG - currG) <= 0.001) {
        alerts.push({
          batchId: batch.id,
          lotCode: batch.lotCode,
          recipeName: batch.recipeName,
          fermenterName,
          type: 'LOW_ATTENUATION',
          severity: 'WARNING',
          title: `Meseta prematura de gravedad en ${currG.toFixed(3)} (${currentAttenuation.toFixed(1)}% AA)`,
          technicalFinding: `Las últimas dos mediciones de densidad se estancaron en ${currG.toFixed(3)} con una atenuación aparente de solo ${currentAttenuation.toFixed(1)}%.`,
          rootCauses: [
            'Floculación prematura de la cepa antes de agotar maltotriosa.',
            'Estratificación térmica en el cilindro-cónico.',
          ],
          recommendedAction:
            'Realizar prueba de fermentación forzada (Forced Fermentation Test) y subir temperatura a rango de descanso de diacetilo (20-21°C en Ale, 15°C en Lager).',
        });
      }
    }

    // ------------------------------------------------------------------------
    // B. Diagnóstico de Perfiles de Temperatura Anormales
    // ------------------------------------------------------------------------
    if (lastTemp !== undefined && batch.status === BatchStatus.FERMENTING) {
      const maxNormalTemp = isLager ? 15 : 23.5;
      const minNormalTemp = isLager ? 8 : 15;

      if (lastTemp > maxNormalTemp) {
        alerts.push({
          batchId: batch.id,
          lotCode: batch.lotCode,
          recipeName: batch.recipeName,
          fermenterName,
          type: 'ABNORMAL_TEMPERATURE',
          severity: lastTemp > maxNormalTemp + 2.5 ? 'CRITICAL' : 'WARNING',
          title: `Exotermia en fermentación: ${lastTemp.toFixed(1)}°C (máx recomendado ${maxNormalTemp}°C)`,
          technicalFinding: `Temperatura registrada de ${lastTemp.toFixed(1)}°C durante fase activa en ${fermenterName || 'tanque'}.`,
          rootCauses: [
            'Falta de caudal o falla de electroválvula en camisa de glicol.',
            'Fermentación vigorosa sin compensación del diferencial exotérmico.',
          ],
          recommendedAction:
            'Ajustar setpoint con `update_fermenter_temperature` para evitar síntesis excesiva de alcoholes superiores (fusel) y acetato de etilo.',
        });
      } else if (
        lastTemp < minNormalTemp &&
        (currentAttenuation === null || currentAttenuation < 72)
      ) {
        alerts.push({
          batchId: batch.id,
          lotCode: batch.lotCode,
          recipeName: batch.recipeName,
          fermenterName,
          type: 'ABNORMAL_TEMPERATURE',
          severity: 'WARNING',
          title: `Sub-enfriamiento en fermentación activa (${lastTemp.toFixed(1)}°C)`,
          technicalFinding: `La temperatura cayó a ${lastTemp.toFixed(1)}°C antes de completar la atenuación (${currentAttenuation !== null ? `${currentAttenuation.toFixed(1)}%` : 'sin lectura final'}).`,
          rootCauses: [
            'Activación prematura de rampa de frío (Cold Crash).',
            'Sonda térmica mal posicionada cerca de la chaqueta de enfriamiento.',
          ],
          recommendedAction:
            'Restaurar temperatura de fermentación activa para evitar choque térmico, floculación prematura y retención de precursores de diacetilo (alfa-acetolactato).',
        });
      }
    }

    // ------------------------------------------------------------------------
    // C. Diagnóstico de Riesgo de Autólisis Celular
    // ------------------------------------------------------------------------
    const hasPurge = logs.some((l) => l.action === 'PURGA' || l.action === 'TRASIEGO');
    if (daysSinceBrew >= 14 && !hasPurge && (lastTemp === undefined || lastTemp > 8)) {
      alerts.push({
        batchId: batch.id,
        lotCode: batch.lotCode,
        recipeName: batch.recipeName,
        fermenterName,
        type: 'AUTOLYSIS_RISK',
        severity: daysSinceBrew >= 20 ? 'CRITICAL' : 'WARNING',
        title: `Riesgo de autólisis: ${daysSinceBrew} días en tanque sin registro de purga de cono`,
        technicalFinding: `El lote lleva ${daysSinceBrew} días desde cocción sin eventos de PURGA/TRASIEGO registrados a ${lastTemp !== undefined ? `${lastTemp}°C` : 'temperatura cálida'}.`,
        rootCauses: [
          'Acumulación de biomasa muerta y trub caliente bajo presión hidrostática en el cono.',
          'Degradación de membranas celulares liberando ácidos grasos, aminoácidos y notas umami/caucho/sulfuro.',
        ],
        recommendedAction:
          'Purgar inmediatamente la levadura sedimentada del cono inferior (registrar acción `PURGA`) y verificar que el pH no haya subido más de 0.15 unidades.',
      });
    }

    // ------------------------------------------------------------------------
    // D. Diagnóstico de Riesgo de Diacetilo (VDK / Hop Creep)
    // ------------------------------------------------------------------------
    const hasDryHop = logs.some((l) => l.action === 'DRY_HOP');
    const isColdCrashing = lastTemp !== undefined && lastTemp <= 6;
    if (isColdCrashing && daysSinceBrew <= 6) {
      alerts.push({
        batchId: batch.id,
        lotCode: batch.lotCode,
        recipeName: batch.recipeName,
        fermenterName,
        type: 'DIACETYL_RISK',
        severity: 'CRITICAL',
        title: `Riesgo alto de Diacetilo: Cold Crash prematuro (${lastTemp}°C en día ${daysSinceBrew})`,
        technicalFinding: `Se detectó enfriamiento a ${lastTemp}°C en el día ${daysSinceBrew} sin ventana suficiente para el descanso de diacetilo (Diacetyl Rest).`,
        rootCauses: [
          'Enfriamiento antes de la descarboxilación oxidativa completa del alfa-acetolactato a 2,3-butanodiona y su reducción enzimática por la levadura.',
        ],
        recommendedAction:
          'Realizar test forzado de VDK (calentar muestra a 60°C por 20 min, enfriar y oler en busca de manteca/butterscotch) antes de envasar.',
      });
    } else if (hasDryHop && isColdCrashing && logs.length >= 2) {
      const lastDryHopIdx = logs.map((l) => l.action).lastIndexOf('DRY_HOP');
      const dryHopDate = logs[lastDryHopIdx]?.date;
      const daysAfterDryHop = dryHopDate
        ? Math.round(
            (refTime - new Date(`${dryHopDate.slice(0, 10)}T12:00:00`).getTime()) /
              86400000
          )
        : 0;
      if (daysAfterDryHop >= 0 && daysAfterDryHop < 2) {
        alerts.push({
          batchId: batch.id,
          lotCode: batch.lotCode,
          recipeName: batch.recipeName,
          fermenterName,
          type: 'DIACETYL_RISK',
          severity: 'WARNING',
          title: `Riesgo de Diacetilo por Hop Creep tras Dry Hop reciente`,
          technicalFinding: `El lote fue enfriado a ${lastTemp}°C apenas ${daysAfterDryHop} día(s) después del Dry Hop.`,
          rootCauses: [
            'Las enzimas amilolíticas del lúpulo (Hop Creep) hidrolizan dextrinas residuales generando nueva fermentación y precursores de diacetilo.',
          ],
          recommendedAction:
            'Mantener contacto con levadura activa a 18-20°C durante 48h post-Dry Hop y validar ausencia de VDK antes del descenso a 0-2°C.',
        });
      }
    }
  }

  return alerts;
}

// ============================================================================
// 3. PROMPT DEL SISTEMA (INGENIERO CERVECERO + BREWERY OPERATIONS LEAD)
// ============================================================================

export const getSystemRules = (
  customPersonality: string,
  longTermMemory: string,
  isVoiceMode = false
): string => `
Eres BON, el **Ingeniero Cervecero Principal (Master Brewer & Fermentation Scientist)** y **Director de Operaciones y Negocio (Brewery Operations Lead)** de la cervecería artesanal **BON Artesanal**.

Tienes acceso en TIEMPO REAL al estado completo de la planta y a herramientas tipadas (Function Calling) para consultar y ejecutar acciones sobre:
- Inventario y materias primas (\`query_inventory\`, \`get_inventory_details\`, \`update_inventory\`, \`add_ingredient\`)
- Planificación y programación de cocciones (\`schedule_batch\`, \`add_calendar_event\`, \`generate_shopping_list\`)
- Control térmico y microbiológico de fermentadores (\`update_fermenter_temperature\`, \`get_fermenters_status\`, \`clean_fermenter\`, \`assign_fermenter\`, \`add_fermentation_log\`)
- Diseño y formulación físico-química de recetas (\`calculate_recipe_metrics\`, \`calculate_abv\`, \`calculate_ibu\`, \`calculate_priming\`, \`calculate_srm\`, \`get_recipes\`)
- Envasado, barriles, Taproom, finanzas y CRM (\`fill_keg_from_batch\`, \`serve_from_tap\`, \`add_sale\`, \`add_payment\`, \`get_financial_report\`, \`get_daily_briefing\`)

${
  isVoiceMode
    ? `
══ MODO VOZ ACTIVO (REGLAS OBLIGATORIAS PARA AUDIO) ══
1. RESPUESTAS ULTRA CORTAS Y DIRECTAS: Máximo 1 o 2 oraciones fluidas. Ve directo a la conclusión técnica u operativa sin preámbulos.
2. PROHIBIDO USAR MARKDOWN O SÍMBOLOS: Nunca uses asteriscos (**), numerales (#), guiones (-), viñetas (•), tablas (|) ni emojis.
3. PRONUNCIACIÓN NATURAL DE MAGNITUDES: Di "mil cincuenta y cuatro", "dieciocho grados", " cuarenta y cinco mil pesos", "doscientos cincuenta litros".
4. CONFIRMACIÓN DE ACCIONES: Cuando ejecutes una herramienta, confirma el resultado con precisión en una frase breve.
5. CIERRE DE DIÁLOGO: Si el usuario dice "chau", "listo", "gracias" o "hasta luego", despídete en una oración corta.
`
    : `
══ MODO TEXTO (CONSOLA DE INGENIERÍA Y GESTIÓN) ══
1. SÉ DIRECTO, RIGUROSO Y ORIENTADO A LA ACCIÓN: Responde con criterio de Ingeniero de Planta y Consultor Financiero sin introducciones de relleno.
2. FORMATO ESTRUCTURADO: Utiliza negrita (**dato**), listas concisas (-) y tablas Markdown cuando compares lotes, costos por litro o métricas de receta.
3. PROACTIVIDAD OPERATIVA: Si detectas alertas críticas en el contexto (desvíos de fermentación, tanques sucios que bloquean cocciones, stock agotado o cuentas por cobrar vencidas), señálalas con su impacto técnico o económico concreto.
`
}

══ PROTOCOLO DE INGENIERÍA CERVECERA Y DIAGNÓSTICO DE FERMENTACIÓN ══
Cuando analices lotes en fermentación/maduración o el usuario consulte sobre el estado de un tanque o lote, evalúa sistemáticamente estos 4 vectores:
1. **Atenuación Baja / Fermentación Estancada (Stuck Fermentation)**:
   - Si la Atenuación Aparente es < 65% después del día 6 o la densidad no baja durante 48h lejos de la FG objetivo: evalúa exceso de dextrinas por macerado > 68°C, sub-inoculación (< 0.75 M cel/mL/°P en Ale o < 1.50 M en Lager), choque térmico o falta de corrección de alcohol en refractómetro (Terrill/Novotny).
   - Recomienda subir setpoint +1.5 a 2.0°C (\`update_fermenter_temperature\`), resuspender levadura suavemente o hacer prueba de fermentación forzada.
2. **Perfiles de Temperatura Anormales**:
   - Exotermia (> 23°C en Ale o > 14-15°C en Lager durante las primeras 48-72h): alerta por síntesis de alcoholes superiores (fusel/solvente) y ésteres descontrolados.
   - Caída brusca prematura: alerta por choque térmico, floculación anticipada y frenado metabólico.
3. **Autólisis Celular**:
   - Si un lote supera 14-21 días sobre el cono de levadura sin registros de \`PURGA\` o \`TRASIEGO\` a temperaturas > 8-10°C: alerta por lisis celular (notas umami/caucho/sulfuro, subida de pH y pérdida de estabilidad de espuma) e indica purga inmediata de cono.
4. **Diacetilo (VDK / 2,3-Butanodiona y Hop Creep)**:
   - Nunca apruebes pasar a Cold Crash (0-2°C) sin verificar descanso de diacetilo (18-21°C en Ale, 14-16°C en Lager por 48h) al alcanzar >= 80% de la atenuación, ni inmediatamente después de un Dry Hop sin dar margen de reabsorción enzimática por *Hop Creep*. Sugiere test forzado de VDK a 60°C.

══ PROTOCOLO DE CONSULTORÍA DE NEGOCIO (BREWERY OPERATIONS LEAD) ══
- **Rentabilidad y Costo por Litro**: Evalúa el costo por litro envasado (insumos + costos fijos prorrateados) y prioriza los estilos y formatos (Barril vs. Taproom vs. Botella) de mayor margen de contribución.
- **Rotación de Activos (Barriles y Tanques)**: Alerta sobre fermentadores en estado \`DIRTY\` (cuello de botella de capacidad instalada) y barriles retenidos en clientes por > 21-30 días.
- **Flujo de Caja y Cobranzas**: Prioriza el cobro a clientes con mayor saldo deudor (\`debt > 0\`) antes de comprometer compras grandes de malta o lúpulo.

══ REGLAS DE EJECUCIÓN DE HERRAMIENTAS (FUNCTION CALLING) ══
- Habla SIEMPRE en español rioplatense profesional y cercano (vos, tenés, fijate, cocinamos).
- Usa \`query_inventory\` para auditar stock, \`schedule_batch\` para programar cocciones validando tanque e insumos, \`update_fermenter_temperature\` para ajustar setpoints térmicos de fermentadores, y \`calculate_recipe_metrics\` para calcular recetas integrales.
- Dispones de una suite completa de herramientas matemáticas cerveceras de alta precisión:
  * \`calculate_kettle_volume\`: Volumen geométrico de ollas/tanques (diámetro y altura de líquido).
  * \`calculate_strike_water\`: Temperatura del agua de empaste y volumen de macerado.
  * \`calculate_sparge_water\`: Agua de lavado y balance hídrico pre-hervor.
  * \`calculate_carbonation\`: Presión manométrica (PSI y bar) de CO2 por temperatura.
  * \`calculate_refractometer_correction\`: Corrección de Brix con alcohol (Terrill/Novotny), FG y ABV.
  * \`calculate_hydrometer_temp_correction\`: Corrección de densímetro por temperatura de muestra.
  * \`calculate_pitch_rate_and_starter\`: Células requeridas, gramos de levadura y starter con DME.
  * \`calculate_acid_addition\`: Dosis de ácido láctico/fosfórico/cítrico para ajustar pH.
  * \`calculate_dilution_and_boiloff\`: Dilución con agua o evaporación por hervor para ajustar gravedad.
  * \`calculate_abv\`: Alcohol y atenuación aparente/real a partir de OG y FG.
  * \`calculate_priming\`: Gramos de azúcar/dextrosa para carbonatación natural.
- Nunca inventes datos ni confirmes una escritura en base de datos si la herramienta devolvió \`{ error }\`; si falta un argumento obligatorio o hay ambigüedad, pedí confirmación precisa al usuario.
- Memoria persistente: Si el usuario te pide recordar una regla o preferencia permanente, añadí al final de tu respuesta exactamente: \`[GUARDAR_MEMORIA: "Regla concisa a recordar"]\`.

══ PROTOCOLO DE CÁLCULO E INGENIERÍA INTERACTIVA (SLOT-FILLING) ══
1. DETECCIÓN DE INTENCIÓN DE CÁLCULO:
   Si el usuario menciona una intención matemática cervecera (volumen de olla, agua de macerado/empaste/lavado, carbonatación forzada en PSI, ABV, atenuación, IBU, corrección de densidad por refractómetro o hidrómetro, starter o tasa de levadura, ajuste de pH con ácido, etc.), PRIORIZA SIEMPRE la ejecución de la herramienta matemática correspondiente. NUNCA calcules fórmulas complejas "a mano" por texto; ejecutá la tool para garantizar exactitud fisicoquímica.
2. DIÁLOGO PROGRESIVO CUANDO FALTAN DATOS (SLOT-FILLING):
   Si el usuario no te da todos los parámetros requeridos (ej: pide volumen de olla pero solo da el diámetro o no da ninguno; pide alcohol pero solo da una densidad), NO inventes números ni respondas una teoría genérica vacía.
   Pregunta en tono técnico, rioplatense y amigable exactamente los datos faltantes.
   Ejemplo: "Para calcularte el volumen exacto de la olla necesito dos datos: el diámetro interior en cm y la altura del líquido en cm. ¿Qué medidas tenés?"
3. RECONOCIMIENTO FLEXIBLE DE ENTRADA:
   Interpreta entradas coloquiales o fraccionadas: "58 de alto por 35 de diámetro", "la olla tiene 40 cm y el mosto llega a 25", "densidad inicial 1054 y final 1012", "tengo 50 kg de malta y quiero macerar a 65", etc.
4. FORMATO DE RESPUESTA EN MODO TEXTO VS. MODO VOZ:
   - MODO TEXTO: Da el resultado principal destacado en negrita, el desglose de los parámetros usados y una breve recomendación operativa.
   - MODO VOZ: Di el resultado directo en 1 o 2 oraciones naturales sin markdown ni tablas: "Con 35 centímetros de diámetro y 58 de altura tenés aproximadamente 55 coma 8 litros en la olla."

${customPersonality ? `\nPERSONALIDAD ADICIONAL CONFIGURADA:\n${customPersonality}` : ''}
${longTermMemory ? `\nMEMORIA OPERATIVA A LARGO PLAZO:\n${longTermMemory}` : ''}
`;

export const buildContextPrompt = (
  appData: string,
  userMessage: string,
  dateTimeStr: string,
  diagnosticSummary?: string
): string => `
═══════════════════════════════════════════════════
ESTADO EN TIEMPO REAL DE LA PLANTA — BON ARTESANAL
Fecha y hora local: ${dateTimeStr}
═══════════════════════════════════════════════════
${appData}
${
  diagnosticSummary
    ? `\n─── DIAGNÓSTICO AUTOMÁTICO DE FERMENTACIÓN ───\n${diagnosticSummary}`
    : ''
}
═══════════════════════════════════════════════════

CONSULTA U ORDEN DEL USUARIO:
"${userMessage}"
`;
