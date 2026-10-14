import { aiActions, ToolResult } from './actions';

/** Herramientas que modifican datos (se listan como "acciones ejecutadas" en el chat). */
export const WRITE_TOOLS = new Set([
  'update_keg_status', 'clean_fermenter', 'update_fermenter_status', 'assign_fermenter', 'update_inventory', 'edit_ingredient', 'add_ingredient', 'update_batch_status',
  'add_fermentation_log', 'add_quality_log', 'fill_keg_from_batch', 'tap_keg', 'serve_from_tap', 'gift_from_tap',
  'update_bottle_stock', 'gift_bottle', 'add_sale', 'add_payment', 'add_expense', 'add_customer', 'update_customer',
  'add_calendar_event', 'complete_calendar_event', 'add_to_shopping_list', 'undo_last_action', 'set_timer', 'cancel_timer',
]);

const obj = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const str = (description: string, extra: Record<string, any> = {}) => ({ type: 'string', description, ...extra });
const numb = (description: string) => ({ type: 'number', description });
const bool = (description: string) => ({ type: 'boolean', description });

export const aiTools = [
  {
    functionDeclarations: [
      // ------------------------------ CÁLCULOS ------------------------------
      {
        name: 'calculate_abv',
        description: 'Calcula el Porcentaje de Alcohol por Volumen (ABV) usando la Gravedad Original (OG) y Gravedad Final (FG).',
        parameters: obj({ og: numb('Gravedad Original (ej: 1.050)'), fg: numb('Gravedad Final (ej: 1.010)') }, ['og', 'fg']),
      },
      {
        name: 'calculate_ibu',
        description: 'Calcula los IBUs (Tinseth) aportados por una adición de lúpulo.',
        parameters: obj({
          alphaAcids: numb('Porcentaje de ácidos alfa del lúpulo (ej: 5.5)'),
          weightGrams: numb('Peso del lúpulo en gramos'),
          volumeLiters: numb('Volumen del lote en litros'),
          boilTimeMins: numb('Tiempo de hervor en minutos'),
          gravity: numb('Gravedad del mosto durante el hervor (ej: 1.050)'),
        }, ['alphaAcids', 'weightGrams', 'volumeLiters', 'boilTimeMins', 'gravity']),
      },
      {
        name: 'calculate_priming',
        description: 'Calcula el azúcar (dextrosa y azúcar de mesa) necesaria para carbonatar en botella.',
        parameters: obj({
          volumeLiters: numb('Volumen a envasar en litros'),
          targetVolumes: numb('Volúmenes de CO2 objetivo (ej: 2.5)'),
          temperatureC: numb('Temperatura máxima que alcanzó la cerveza después de fermentar (°C)'),
        }, ['volumeLiters', 'targetVolumes', 'temperatureC']),
      },
      {
        name: 'calculate_srm',
        description: 'Calcula el color de la cerveza en SRM usando la ecuación de Morey.',
        parameters: obj({ mcu: numb('Malt Color Units: (Peso Lbs * Color Lovibond) / Volumen Galones') }, ['mcu']),
      },

      // ------------------------------ LECTURA ------------------------------
      { name: 'get_daily_briefing', description: 'Resumen completo del día: agenda de hoy y atrasada, fermentadores y barriles sucios para CIP/limpieza, clientes deudores para llamar/cobrar, faltantes de stock crítico y cómo vienen los lotes en fermentación. Usar para "¿qué tengo para hacer hoy?", "plan del día" o "resumen".', parameters: obj() },
      { name: 'get_inventory_details', description: 'Lista de insumos con stock, unidad, costo y lote.', parameters: obj({ filter: str('(Opcional) Filtrar por nombre o tipo (MALT, HOP, YEAST, ADJUNCT, CHEMICAL, PACKAGING)') }) },
      { name: 'get_active_batches', description: 'Lotes activos (no agotados) con estado, fermentador asignado, días desde la cocción, densidades, volúmenes, costos y últimos registros de fermentación.', parameters: obj() },
      { name: 'get_batch_details', description: 'Detalle completo de UN lote (activo o histórico): ingredientes, fermentador, todos los registros de fermentación, controles de calidad y perfiles sensoriales.', parameters: obj({ lotCode: str('Código del lote o nombre de la receta') }, ['lotCode']) },
      { name: 'get_batch_history', description: 'Lotes terminados/históricos con ABV, costo por litro, puntaje sensorial promedio y defectos. Usar para análisis de calidad o tendencias.', parameters: obj({ limit: numb('Cantidad de lotes (default 10, máx 30)') }) },
      { name: 'get_financial_report', description: 'Reporte financiero de un mes: ingresos, gastos por categoría, ventas por tipo, ventas impagas, costos fijos configurados e historial de cierres.', parameters: obj({ month: str('(Opcional) Mes en formato YYYY-MM. Default: mes actual') }) },
      { name: 'get_fermenters_status', description: 'Todos los fermentadores: estado (AVAILABLE, OCCUPIED, DIRTY, MAINTENANCE), capacidad en litros, lote actual que contiene (receta, días en tanque, densidades, temperatura) y fecha de último CIP.', parameters: obj() },
      { name: 'get_kegs_status', description: 'Todos los barriles: estado (IN_HOUSE, WITH_CLIENT, DIRTY), ubicación, contenido, litros, si está pinchado y días con el cliente.', parameters: obj() },
      { name: 'get_bottle_stock', description: 'Stock de botellas/latas envasadas por estilo, formato y lote.', parameters: obj() },
      { name: 'get_recipes', description: 'Recetas maestras con ingredientes y parámetros objetivo.', parameters: obj() },
      { name: 'get_customers', description: 'Clientes (CRM) con contacto, dirección, deuda y ventas totales.', parameters: obj({ filter: str('(Opcional) Filtrar por nombre') }) },
      { name: 'get_customer_statement', description: 'Cuenta corriente de un cliente: ventas, pagos, deuda y barriles que tiene.', parameters: obj({ customer: str('Nombre del cliente') }, ['customer']) },
      { name: 'get_calendar_events', description: 'Eventos del calendario de producción (cocciones, envasados, entregas, limpiezas, etc.) y eventos atrasados.', parameters: obj({ daysAhead: numb('Días hacia adelante (default 7)'), daysBack: numb('Días hacia atrás (default 0)'), includeCompleted: bool('Incluir eventos completados') }) },
      { name: 'get_shopping_list', description: 'Lista de compras actual.', parameters: obj() },
      { name: 'generate_shopping_list', description: 'Calcula qué insumos faltan para las cocciones agendadas en el calendario comparando recetas vs. inventario.', parameters: obj({ daysAhead: numb('Días hacia adelante (ej: 30)') }, ['daysAhead']) },
      { name: 'get_timers', description: 'Timers activos y minutos restantes.', parameters: obj() },

      // ------------------------------ ESCRITURA ------------------------------
      {
        name: 'clean_fermenter',
        description: 'Marca un fermentador como limpio y desinfectado (CIP realizado). Pasa el estado a AVAILABLE y registra la fecha de limpieza.',
        parameters: obj({
          fermenterId: str('Nombre o número del fermentador (ej: "1", "Fermentador 1", "F-01")'),
          notes: str('(Opcional) Notas sobre el proceso de limpieza o sanitizante usado'),
        }, ['fermenterId']),
      },
      {
        name: 'update_fermenter_status',
        description: 'Cambia el estado de un fermentador (AVAILABLE=Disponible/Limpio, OCCUPIED=Ocupado, DIRTY=Sucio/Para lavar, MAINTENANCE=Mantenimiento).',
        parameters: obj({
          fermenterId: str('Nombre o número del fermentador (ej: "1", "F-02")'),
          status: str('Nuevo estado', { enum: ['AVAILABLE', 'OCCUPIED', 'DIRTY', 'MAINTENANCE'] }),
          notes: str('(Opcional) Observaciones o motivos'),
        }, ['fermenterId', 'status']),
      },
      {
        name: 'assign_fermenter',
        description: 'Asigna un lote de cerveza en producción a un fermentador específico y lo pasa a OCCUPIED.',
        parameters: obj({
          fermenterId: str('Nombre o número del fermentador (ej: "1", "Fermentador 2")'),
          lotCode: str('Código del lote o receta'),
        }, ['fermenterId', 'lotCode']),
      },
      {
        name: 'update_keg_status',
        description: 'Cambia el estado de un barril. DIRTY = vacío/para lavar (borra contenido). IN_HOUSE = en planta/limpio. WITH_CLIENT = entregado (si es una venta, registrá además add_sale con type KEG).',
        parameters: obj({
          kegId: str('Número o código del barril (ej: "045", "12")'),
          status: str('Nuevo estado', { enum: ['IN_HOUSE', 'WITH_CLIENT', 'DIRTY'] }),
          customer: str('(Opcional, para WITH_CLIENT) Nombre del cliente'),
          location: str('(Opcional) Ubicación'),
        }, ['kegId', 'status']),
      },
      {
        name: 'update_inventory',
        description: 'Modifica el stock de un insumo. Usá amountChange para sumar/restar (negativo descuenta) o newAmount para fijar el valor exacto (ej: después de un conteo).',
        parameters: obj({
          ingredientName: str('Nombre del insumo'),
          amountChange: numb('Cantidad a sumar (positivo) o restar (negativo), en la unidad del insumo'),
          newAmount: numb('(Alternativa) Nuevo stock absoluto'),
        }, ['ingredientName']),
      },
      {
        name: 'edit_ingredient',
        description: 'Edita datos de un insumo existente: precio por unidad, número de lote, nombre o unidad.',
        parameters: obj({ ingredientName: str('Nombre actual del insumo'), costPerUnit: numb('Nuevo costo por unidad'), lotNumber: str('Nuevo número de lote'), newName: str('Nuevo nombre'), unit: str('Nueva unidad') }, ['ingredientName']),
      },
      {
        name: 'add_ingredient',
        description: 'Da de alta un insumo NUEVO (registra automáticamente el gasto de compra). Si ya existe, usar update_inventory.',
        parameters: obj({
          name: str('Nombre'),
          type: str('Tipo', { enum: ['MALT', 'HOP', 'YEAST', 'ADJUNCT', 'CHEMICAL', 'PACKAGING'] }),
          stockAmount: numb('Cantidad comprada'),
          unit: str('Unidad (kg, g, L, sobres, unidades)'),
          costPerUnit: numb('Costo por unidad'),
          lotNumber: str('(Opcional) Lote del proveedor'),
        }, ['name', 'type', 'stockAmount', 'unit', 'costPerUnit']),
      },
      {
        name: 'update_batch_status',
        description: 'Cambia el estado de un lote. Para PACKAGED (Finalizado) se necesitan los litros finales envasados.',
        parameters: obj({
          lotCode: str('Código del lote o nombre de la receta'),
          status: str('Nuevo estado: PLANNED=Planificado, MASHING=Macerado/Hervor, FERMENTING=Fermentando, CONDITIONING=Madurando, PACKAGED=Finalizado (listo para envasar/vender), COMPLETED=Agotado/Historial', { enum: ['PLANNED', 'MASHING', 'FERMENTING', 'CONDITIONING', 'PACKAGED', 'COMPLETED'] }),
          volumePackaged: numb('(Requerido para PACKAGED si el lote no lo tiene) Litros finales'),
        }, ['lotCode', 'status']),
      },
      {
        name: 'add_fermentation_log',
        description: 'Registra una medición o acción en la fermentación de un lote (densidad, temperatura, dry hop, purga, trasiego, etc.).',
        parameters: obj({
          lotCode: str('Código del lote o receta'),
          action: str('Tipo de registro', { enum: ['MEDICION', 'DRY_HOP', 'CLARIFICANTE', 'PURGA', 'TRASIEGO', 'OTRO'] }),
          gravity: numb('Densidad (ej: 1.012; si dicen "mil doce" es 1.012)'),
          temperature: numb('Temperatura en °C'),
          notes: str('Notas'),
          date: str('(Opcional) Fecha YYYY-MM-DD, default hoy'),
        }, ['lotCode']),
      },
      {
        name: 'add_quality_log',
        description: 'Registra un control de calidad en un lote (pH, densidad, temperatura, carbonatación, nota sensorial, análisis de laboratorio).',
        parameters: obj({
          lotCode: str('Código del lote o receta'),
          type: str('Tipo', { enum: ['PH', 'GRAVITY', 'TEMPERATURE', 'CARBONATION', 'SENSORY', 'LAB_ANALYSIS'] }),
          value: str('Valor medido (número o texto)'),
          unit: str('(Opcional) Unidad'),
          notes: str('(Opcional) Notas'),
          technician: str('(Opcional) Quién midió'),
        }, ['lotCode', 'type', 'value']),
      },
      {
        name: 'fill_keg_from_batch',
        description: 'Llena un barril con cerveza de un lote Finalizado (descuenta litros del lote).',
        parameters: obj({
          kegId: str('Número o código del barril'),
          lotCode: str('Código del lote o receta'),
          liters: numb('(Opcional) Litros; default capacidad del barril'),
          confirmClean: bool('true solo si el usuario confirmó que el barril (figura sucio) ya está limpio'),
        }, ['kegId', 'lotCode']),
      },
      { name: 'tap_keg', description: 'Pincha (o despincha) un barril en la canilla del taproom.', parameters: obj({ kegId: str('Número o código del barril'), tapped: bool('true = pinchar, false = despinchar') }, ['kegId']) },
      {
        name: 'serve_from_tap',
        description: 'Registra una venta servida desde la canilla (descuenta litros del barril y crea la venta TAPROOM).',
        parameters: obj({ kegId: str('Barril pinchado'), liters: numb('Litros servidos (pinta = 0.5)'), formatName: str('Formato (ej: "Pinta", "Media pinta")'), price: numb('Precio cobrado') }, ['kegId', 'liters', 'price']),
      },
      {
        name: 'gift_from_tap',
        description: 'Registra cerveza regalada desde la canilla (descuenta litros y registra el costo como gasto REGALO).',
        parameters: obj({ kegId: str('Barril pinchado'), liters: numb('Litros'), formatName: str('Formato') }, ['kegId', 'liters']),
      },
      {
        name: 'update_bottle_stock',
        description: 'Suma o resta unidades del stock de botellas/latas (ej: venta o rotura). Si es una venta, registrá además add_sale con type BOTTLE.',
        parameters: obj({ bottle: str('Estilo y/o formato o lote (ej: "IPA 500")'), quantityChange: numb('Unidades (negativo resta)') }, ['bottle', 'quantityChange']),
      },
      { name: 'gift_bottle', description: 'Registra botellas regaladas (descuenta stock y registra el costo como gasto REGALO).', parameters: obj({ bottle: str('Estilo y/o formato'), quantity: numb('Unidades') }, ['bottle', 'quantity']) },
      {
        name: 'add_sale',
        description: 'Registra una venta. Si tiene cliente y no se aclara, queda a cuenta corriente (suma deuda).',
        parameters: obj({
          amount: numb('Monto total'),
          description: str('Descripción (ej: "2 barriles IPA 50L")'),
          type: str('Tipo de venta', { enum: ['KEG', 'BOTTLE', 'TAPROOM'] }),
          customer: str('(Opcional) Nombre del cliente del CRM'),
          isPaid: bool('(Opcional) true si ya se cobró'),
          quantity: numb('(Opcional) Cantidad de unidades'),
          lotCode: str('(Opcional) Lote vendido, para rentabilidad'),
        }, ['amount', 'description', 'type']),
      },
      { name: 'add_payment', description: 'Registra un pago recibido de un cliente (baja su deuda).', parameters: obj({ customer: str('Nombre del cliente'), amount: numb('Monto'), notes: str('Notas') }, ['customer', 'amount']) },
      {
        name: 'add_expense',
        description: 'Registra un gasto.',
        parameters: obj({ description: str('Descripción'), amount: numb('Monto'), category: str('Categoría', { enum: ['INVENTORY', 'FIXED', 'MAINTENANCE', 'MARKETING', 'LOGISTICS', 'ADMIN', 'OTHER', 'REGALO'] }) }, ['description', 'amount', 'category']),
      },
      { name: 'add_customer', description: 'Crea un cliente nuevo en el CRM.', parameters: obj({ name: str('Nombre o negocio'), contact: str('Teléfono o email'), address: str('Dirección o zona'), debt: numb('Deuda inicial (0 si no tiene)') }, ['name']) },
      { name: 'update_customer', description: 'Actualiza datos de un cliente.', parameters: obj({ customer: str('Nombre actual del cliente'), name: str('Nuevo nombre'), contact: str('Contacto'), address: str('Dirección'), debt: numb('Deuda corregida') }, ['customer']) },
      {
        name: 'add_calendar_event',
        description: 'Agenda un evento en el calendario de producción. Calculá la fecha a partir de la fecha actual del contexto.',
        parameters: obj({
          title: str('Título (ej: "Cocción IPA", "Entrega Bar X")'),
          date: str('Fecha YYYY-MM-DD'),
          type: str('Tipo', { enum: ['BREW', 'FERMENTATION_END', 'MATURATION_START', 'PACKAGING', 'MAINTENANCE', 'DELIVERY', 'CLEANING', 'CUSTOM'] }),
          notes: str('(Opcional) Notas u hora'),
          lotCode: str('(Opcional) Lote relacionado'),
        }, ['title', 'date']),
      },
      { name: 'complete_calendar_event', description: 'Marca como hecho un evento pendiente del calendario.', parameters: obj({ event: str('Título del evento') }, ['event']) },
      { name: 'add_to_shopping_list', description: 'Agrega un ítem a la lista de compras.', parameters: obj({ text: str('Qué comprar (ej: "25 kg Malta Pilsen")'), estimatedCost: numb('(Opcional) Costo estimado') }, ['text']) },
      { name: 'undo_last_action', description: 'Deshace la última acción que hizo el asistente (venta, gasto, stock, estado, etc.). Los pagos no se pueden deshacer.', parameters: obj() },

      // ------------------------------ APP ------------------------------
      {
        name: 'navigate_to',
        description: 'Abre una sección de la app.',
        parameters: obj({ section: str('Sección: inicio, produccion, inventario, envasado/barriles/botellas, calculadoras, chat, clientes, recetas, calendario, coccion') }, ['section']),
      },
      { name: 'set_timer', description: 'Programa un timer/recordatorio (ej: adiciones de lúpulo, fin de macerado). Avisa con sonido, voz y notificación.', parameters: obj({ minutes: numb('Minutos'), label: str('Qué hay que hacer cuando suene') }, ['minutes']) },
      { name: 'cancel_timer', description: 'Cancela un timer activo.', parameters: obj({ label: str('(Opcional) Nombre del timer; default el último') }) },
    ],
  },
];

type Handler = (args: any) => ToolResult;

const HANDLERS: Record<string, Handler> = {
  calculate_abv: ({ og, fg }) => ({ abv: Number(((og - fg) * 131.25).toFixed(2)), unit: '%' }),
  calculate_ibu: ({ alphaAcids, weightGrams, volumeLiters, boilTimeMins, gravity }) => {
    const bigness = 1.65 * Math.pow(0.000125, gravity - 1.0);
    const boilTimeFactor = (1 - Math.exp(-0.04 * boilTimeMins)) / 4.15;
    const ibu = (weightGrams * (alphaAcids / 100) * bigness * boilTimeFactor * 1000) / volumeLiters;
    return { ibu: Number(ibu.toFixed(2)) };
  },
  calculate_priming: ({ volumeLiters, targetVolumes, temperatureC }) => {
    const tempF = temperatureC * 9 / 5 + 32;
    // Residual CO2 (fórmula estándar en °F)
    const residualCO2 = 3.0378 - 0.050062 * tempF + 0.00026555 * tempF * tempF;
    const co2Needed = Math.max(0, targetVolumes - residualCO2);
    const sugarGrams = co2Needed * volumeLiters * 4.0; // ~4 g/L de dextrosa por volumen de CO2
    return { residualCO2: Number(residualCO2.toFixed(2)), dextroseGrams: Number(sugarGrams.toFixed(1)), tableSugarGrams: Number((sugarGrams * 0.91).toFixed(1)) };
  },
  calculate_srm: ({ mcu }) => ({ srm: Number((1.4922 * Math.pow(mcu, 0.6859)).toFixed(2)) }),

  get_daily_briefing: () => aiActions.getDailyBriefing(),
  get_inventory_details: a => aiActions.getInventoryDetails(a),
  get_active_batches: () => aiActions.getActiveBatches(),
  get_batch_details: a => aiActions.getBatchDetails(a),
  get_batch_history: a => aiActions.getBatchHistory(a),
  get_financial_report: a => aiActions.getFinancialReport(a),
  get_fermenters_status: () => aiActions.getFermentersStatus(),
  get_kegs_status: () => aiActions.getKegsStatus(),
  get_bottle_stock: () => aiActions.getBottleStock(),
  get_recipes: () => aiActions.getRecipes(),
  get_customers: a => aiActions.getCustomers(a),
  get_customer_statement: a => aiActions.getCustomerStatement(a),
  get_calendar_events: a => aiActions.getCalendarEvents(a),
  get_shopping_list: () => aiActions.getShoppingList(),
  generate_shopping_list: a => aiActions.generateShoppingList(a),
  get_timers: () => aiActions.getTimers(),

  clean_fermenter: a => aiActions.cleanFermenter(a),
  update_fermenter_status: a => aiActions.updateFermenterStatus(a),
  assign_fermenter: a => aiActions.assignBatchToFermenter(a),
  update_keg_status: a => aiActions.updateKegStatus(a),
  update_inventory: a => aiActions.updateInventory(a),
  edit_ingredient: a => aiActions.editIngredient(a),
  add_ingredient: a => aiActions.addIngredient(a),
  update_batch_status: a => aiActions.updateBatchStatus(a),
  add_fermentation_log: a => aiActions.addFermentationLog(a),
  add_quality_log: a => aiActions.addQualityLog(a),
  fill_keg_from_batch: a => aiActions.fillKegFromBatch(a),
  tap_keg: a => aiActions.tapKeg(a),
  serve_from_tap: a => aiActions.serveFromTap(a),
  gift_from_tap: a => aiActions.giftFromTap(a),
  update_bottle_stock: a => aiActions.updateBottleStock(a),
  gift_bottle: a => aiActions.giftBottle(a),
  add_sale: a => aiActions.addSale(a),
  add_payment: a => aiActions.addPayment(a),
  add_expense: a => aiActions.addExpense(a),
  add_customer: a => aiActions.addCustomer(a),
  update_customer: a => aiActions.updateCustomer(a),
  add_calendar_event: a => aiActions.addCalendarEvent(a),
  complete_calendar_event: a => aiActions.completeCalendarEvent(a),
  add_to_shopping_list: a => aiActions.addToShoppingList(a),
  undo_last_action: () => aiActions.undoLastAction(),

  navigate_to: a => aiActions.navigateTo(a),
  set_timer: a => aiActions.setTimer(a),
  cancel_timer: a => aiActions.cancelTimer(a),
};

/** Ejecuta una herramienta. Nunca lanza: los errores se devuelven como `{ error }` para que la IA los informe. */
export const executeTool = (name: string, args: any): ToolResult => {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Herramienta desconocida: ${name}` };
  try {
    const result = handler(args || {});
    return result && typeof result === 'object' && !Array.isArray(result) ? result : { result };
  } catch (e) {
    console.error(`[AI tools] Error en ${name}:`, e);
    return { error: `Falló ${name}: ${e instanceof Error ? e.message : String(e)}` };
  }
};
