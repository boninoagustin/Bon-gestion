/**
 * Acciones que la IA (voz y texto) puede ejecutar sobre la planta.
 *
 * - Siempre lee el estado ACTUAL del store con `useBreweryStore.getState()`
 *   (evita datos viejos dentro de una misma conversación).
 * - Resuelve barriles/lotes/insumos/clientes por nombre o código y
 *   avisa si hay ambigüedad o si no existe (nunca devuelve success falso).
 * - Registra un stack de "deshacer" para las acciones reversibles.
 */
import { useBreweryStore } from '../../context/store';
import { BatchStatus, EventType, ViewState, Keg, Expense, Ingredient, QualityLog, FermentationLog, Fermenter, FermenterStatus } from '../../types';

export type ToolResult = Record<string, any>;

const S = () => useBreweryStore.getState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fecha local YYYY-MM-DD (toISOString usa UTC y después de las 21hs da el día siguiente en AR). */
export const localToday = () => new Date().toLocaleDateString('en-CA');
const monthKeyOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-CA');
};
const daysBetween = (from: string, to: string = localToday()) =>
    Math.round((new Date(to.slice(0, 10) + 'T12:00:00').getTime() - new Date(from.slice(0, 10) + 'T12:00:00').getTime()) / 86400000);

export const normalizeText = (s: unknown) =>
    String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/#/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const digitsOf = (s: string) => s.replace(/\D/g, '');
const round = (n: number, d = 2) => Number((Number(n) || 0).toFixed(d));
const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
};

interface Resolved<T> { item?: T; error?: string }

/**
 * Busca un elemento por coincidencia exacta y, si no hay, por coincidencia parcial.
 * Si hay varias coincidencias y `prefer` deja solo una, usa esa; si no, devuelve error de ambigüedad.
 */
function resolveOne<T>(
    list: T[],
    query: unknown,
    keys: (i: T) => (string | undefined)[],
    label: string,
    opts: { numeric?: boolean; prefer?: (i: T) => boolean } = {}
): Resolved<T> {
    const q = normalizeText(query);
    if (!q) return { error: `Falta indicar ${label}.` };
    const names = (i: T) => keys(i).filter(Boolean).map(k => normalizeText(k));
    const qDigits = digitsOf(q);

    const exact = list.filter(i => {
        const n = names(i);
        if (n.includes(q)) return true;
        if (opts.numeric && qDigits && qDigits.length === q.replace(/\s/g, '').length) {
            return n.some(x => digitsOf(x) && parseInt(digitsOf(x), 10) === parseInt(qDigits, 10));
        }
        return false;
    });
    let pool = exact.length > 0 ? exact : list.filter(i => names(i).some(n => n.includes(q) || (q.length > 3 && q.includes(n) && n.length > 3)));

    if (pool.length > 1 && opts.prefer) {
        const preferred = pool.filter(opts.prefer);
        if (preferred.length === 1) pool = preferred;
    }
    if (pool.length === 1) return { item: pool[0] };
    if (pool.length > 1) {
        return { error: `Hay ${pool.length} coincidencias de ${label} para "${query}": ${pool.slice(0, 8).map(i => keys(i)[0]).join(', ')}. Preguntale al usuario cuál es.` };
    }
    return { error: `No encontré ${label} "${query}". No lo inventes: avisale al usuario y, si sirve, ofrecé las opciones existentes.` };
}

const findKeg = (q: unknown) => resolveOne(S().kegs, q, k => [k.id], 'barril', { numeric: true });
const findBatch = (q: unknown) =>
    resolveOne(S().batches, q, b => [b.lotCode, b.id, b.recipeName], 'lote', { prefer: b => b.status !== BatchStatus.COMPLETED });
const findIngredient = (q: unknown) => resolveOne(S().inventory, q, i => [i.name, i.lotNumber], 'insumo');
const findCustomer = (q: unknown) => resolveOne(S().customers, q, c => [c.name, c.id, c.contact], 'cliente');
const findBottle = (q: unknown) =>
    resolveOne(S().bottles, q, b => [`${b.style} ${b.format}`, b.style, b.lotCode, b.format], 'stock de botellas', { prefer: b => b.quantity > 0 });
const fermenterAlias = (value: unknown) => {
    const text = normalizeText(value);
    const match = text.match(/^(?:(?:f|fermentador|tanque)[\s-]*)?0*(\d+)$/);
    return match ? `tanque:${Number(match[1])}` : text;
};
const findFermenter = (q: unknown): Resolved<Fermenter> => {
    const list = S().fermenters || [];
    const exact = list.filter(f => [f.id, f.name].some(v => normalizeText(v) === normalizeText(q)));
    if (exact.length === 1) return { item: exact[0] };
    const alias = fermenterAlias(q);
    const candidates = alias.startsWith('tanque:')
        ? list.filter(f => [f.name, f.id].some(v => fermenterAlias(v) === alias)) : list;
    return resolveOne(candidates, alias, f => [fermenterAlias(f.name), fermenterAlias(f.id)], 'fermentador');
};

// ---------------------------------------------------------------------------
// Undo stack
// ---------------------------------------------------------------------------

interface UndoEntry { label: string; undo: () => void }
const undoStack: UndoEntry[] = [];
const pushUndo = (label: string, undo: () => void) => {
    undoStack.push({ label, undo });
    if (undoStack.length > 20) undoStack.shift();
};

// ---------------------------------------------------------------------------
// Eventos globales (navegación y timers) — escuchados por App y VoiceAssistant
// ---------------------------------------------------------------------------

export const AI_EVENTS = {
    NAVIGATE: 'bon:navigate',
    TIMER_DONE: 'bon:timer-done',
} as const;

interface ActiveTimer { id: string; label: string; endsAt: number; handle: ReturnType<typeof setTimeout> }
const timers = new Map<string, ActiveTimer>();

const notify = (title: string, body: string) => {
    try {
        const api = (window as any).electronAPI;
        if (api?.sendNotification) { api.sendNotification(title, body); return; }
        if ('Notification' in window) {
            if (Notification.permission === 'granted') new Notification(title, { body });
            else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body }); });
        }
    } catch { /* noop */ }
};

const NAV_MAP: Record<string, ViewState> = {
    inicio: ViewState.DASHBOARD, dashboard: ViewState.DASHBOARD, tablero: ViewState.DASHBOARD, resumen: ViewState.DASHBOARD, finanzas: ViewState.DASHBOARD,
    produccion: ViewState.PRODUCTION, lotes: ViewState.PRODUCTION, lote: ViewState.PRODUCTION, fermentadores: ViewState.PRODUCTION,
    inventario: ViewState.INVENTORY, insumos: ViewState.INVENTORY, stock: ViewState.INVENTORY,
    envasado: ViewState.PACKAGING, barriles: ViewState.PACKAGING, botellas: ViewState.PACKAGING, packaging: ViewState.PACKAGING, canillas: ViewState.PACKAGING,
    calculadoras: ViewState.CALCULATORS, calculadora: ViewState.CALCULATORS,
    ia: ViewState.AI_CONSULTANT, chat: ViewState.AI_CONSULTANT, asistente: ViewState.AI_CONSULTANT, consultor: ViewState.AI_CONSULTANT,
    clientes: ViewState.CRM, crm: ViewState.CRM,
    recetas: ViewState.RECIPES, receta: ViewState.RECIPES,
    calendario: ViewState.CALENDAR, agenda: ViewState.CALENDAR,
    coccion: ViewState.BREW_ASSISTANT, cocinar: ViewState.BREW_ASSISTANT, 'asistente de coccion': ViewState.BREW_ASSISTANT,
};

// ---------------------------------------------------------------------------
// Resúmenes (compactos para no gastar tokens)
// ---------------------------------------------------------------------------

const lastReading = (logs: FermentationLog[], key: 'gravity' | 'temperature') =>
    [...logs].reverse().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .find(l => typeof l[key] === 'number' && Number.isFinite(l[key]))?.[key];

const summarizeBatch = (b: ReturnType<typeof S>['batches'][number], full = false) => {
    const logs = b.fermentationLogs || [];
    const lastGravity = lastReading(logs, 'gravity');
    const lastTemp = lastReading(logs, 'temperature');
    const sensory = b.sensoryProfiles || [];
    const fermenterName = b.fermenterName || (b.fermenterId ? S().fermenters.find(f => f.id === b.fermenterId)?.name : undefined);
    const base: ToolResult = {
        lotCode: b.lotCode,
        recipeName: b.recipeName,
        style: b.style,
        status: b.status,
        fermenterId: b.fermenterId || undefined,
        fermenterName: fermenterName || undefined,
        brewDate: b.brewDate,
        daysSinceBrew: b.brewDate ? daysBetween(b.brewDate) : undefined,
        originalGravity: b.originalGravity || undefined,
        finalGravity: b.finalGravity || undefined,
        lastGravityReading: lastGravity,
        lastTemperatureReading: lastTemp,
        volumeFermenter: b.volumeFermenter,
        volumePackaged: b.volumePackaged,
        volumeAvailable: b.volumeAvailable,
        totalCost: round((b.totalIngredientsCost || 0) + (b.overheadCost || 0), 0),
        costPerLiter: b.volumePackaged ? round(((b.totalIngredientsCost || 0) + (b.overheadCost || 0)) / b.volumePackaged, 0) : undefined,
        sensoryAvgScore: sensory.length ? round(sensory.reduce((s, p) => s + (p.overallScore || 0), 0) / sensory.length, 1) : undefined,
        defects: Array.from(new Set(sensory.flatMap(p => p.defects || []))),
        notes: b.notes,
    };
    if (full) {
        base.ingredientsUsed = (b.ingredientsUsed || []).map(i => ({ name: i.name, amount: i.amountUsed, unit: i.unit }));
        base.fermentationLogs = logs;
        base.qualityLogs = b.qualityLogs || [];
        base.sensoryProfiles = sensory;
    } else {
        base.recentFermentationLogs = logs.slice(-5);
    }
    return base;
};

/** Resumen corto que se inyecta en cada mensaje (voz y texto). */
export const buildAppSummary = (): string => {
    const st = S();
    const mk = monthKeyOf();
    const today = localToday();
    const out: string[] = [];

    const active = st.batches.filter(b => b.status !== BatchStatus.COMPLETED);
    out.push(`Lotes activos: ${active.length}`);
    active.slice(0, 15).forEach(b => {
        const fInfo = b.fermenterName ? ` [${b.fermenterName}]` : (b.fermenterId ? ` [${st.fermenters.find(f => f.id === b.fermenterId)?.name || 'Tanque'}]` : '');
        const days = b.brewDate ? ` día ${daysBetween(b.brewDate)}` : '';
        const logs = b.fermentationLogs || [];
        const lastGrav = lastReading(logs, 'gravity');
        const lastTemp = lastReading(logs, 'temperature');
        const readings = (lastGrav ? ` Grav:${lastGrav}` : '') + (lastTemp !== undefined ? ` Temp:${lastTemp}°C` : '');
        out.push(`- ${b.recipeName} (${b.status})${fInfo} [Código: ${b.lotCode}]${days}${readings}`);
    });

    const fermenters = st.fermenters || [];
    if (fermenters.length) {
        const dirtyF = fermenters.filter(f => f.status === 'DIRTY');
        const occupiedF = fermenters.filter(f => f.status === 'OCCUPIED');
        const availF = fermenters.filter(f => f.status === 'AVAILABLE');
        const maintF = fermenters.filter(f => f.status === 'MAINTENANCE');
        out.push(`Fermentadores (${fermenters.length}): ${availF.length} disponibles | ${occupiedF.length} ocupados | ${dirtyF.length} sucios para CIP${dirtyF.length ? ` (${dirtyF.map(f => f.name).join(', ')})` : ''}${maintF.length ? ` | ${maintF.length} en mantenimiento` : ''}`);
    }

    const noStock = st.inventory.filter(i => i.stockAmount <= 0);
    if (noStock.length) out.push(`Sin stock: ${noStock.map(i => i.name).join(', ')}`);
    const lowStock = st.inventory.filter(i => i.stockAmount > 0 && i.stockAmount <= 5);
    if (lowStock.length) out.push(`Stock bajo (<=5): ${lowStock.slice(0, 8).map(i => `${i.name} (${i.stockAmount}${i.unit})`).join(', ')}`);

    const dirty = st.kegs.filter(k => k.status === 'DIRTY');
    out.push(`Barriles sucios: ${dirty.length}${dirty.length ? ` (${dirty.map(k => k.id).join(', ')})` : ''}`);
    const tapped = st.kegs.filter(k => k.isTapped);
    if (tapped.length) out.push(`Pinchados: ${tapped.map(k => `${k.id} ${k.contents || ''} ${round(k.currentVolume ?? k.size, 1)}L`).join(' | ')}`);

    const debtors = st.customers.filter(c => c.debt > 0);
    if (debtors.length) {
        const topDebtors = [...debtors].sort((a, b) => b.debt - a.debt).slice(0, 5);
        out.push(`Deuda clientes ($${round(debtors.reduce((s, c) => s + c.debt, 0), 0)} en ${debtors.length} clientes): ${topDebtors.map(c => `${c.name} debe $${round(c.debt, 0)}${c.contact ? ` (Tel: ${c.contact})` : ''}`).join(' | ')}`);
    }

    const salesM = st.sales.filter(s => s.date?.startsWith(mk)).reduce((s, x) => s + (x.amount || 0), 0);
    const expM = st.expenses.filter(e => e.date?.startsWith(mk)).reduce((s, x) => s + (x.amount || 0), 0);
    out.push(`Mes actual (${mk}) -> Ventas: $${round(salesM, 0)} | Gastos: $${round(expM, 0)}`);

    const todayEvents = st.calendarEvents.filter(e => !e.completed && e.start?.slice(0, 10) === today);
    if (todayEvents.length) out.push(`Agenda de hoy: ${todayEvents.map(e => e.title).join(', ')}`);
    const overdueEvents = st.calendarEvents.filter(e => !e.completed && e.start?.slice(0, 10) < today);
    if (overdueEvents.length) out.push(`Tareas atrasadas: ${overdueEvents.slice(0, 5).map(e => `${e.title} (${e.start.slice(0, 10)})`).join(', ')}`);

    if (timers.size) out.push(`Timers activos: ${[...timers.values()].map(t => `${t.label} (faltan ${Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000))} min)`).join(', ')}`);
    return out.join('\n');
};

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

const KEG_STATUSES: Keg['status'][] = ['IN_HOUSE', 'WITH_CLIENT', 'DIRTY'];
const EXPENSE_CATEGORIES: Expense['category'][] = ['INVENTORY', 'FIXED', 'MAINTENANCE', 'MARKETING', 'LOGISTICS', 'ADMIN', 'OTHER', 'REGALO'];
const INGREDIENT_TYPES: Ingredient['type'][] = ['MALT', 'HOP', 'YEAST', 'ADJUNCT', 'CHEMICAL', 'PACKAGING'];
const QUALITY_TYPES: QualityLog['type'][] = ['PH', 'GRAVITY', 'TEMPERATURE', 'CARBONATION', 'SENSORY', 'LAB_ANALYSIS'];
const FERMENTATION_ACTIONS: NonNullable<FermentationLog['action']>[] = ['MEDICION', 'DRY_HOP', 'CLARIFICANTE', 'PURGA', 'TRASIEGO', 'OTRO'];

const BATCH_STATUS_MAP: Record<string, BatchStatus> = {
    PLANNED: BatchStatus.PLANNED,
    MASHING: BatchStatus.MASHING,
    FERMENTING: BatchStatus.FERMENTING,
    CONDITIONING: BatchStatus.CONDITIONING,
    MATURATING: BatchStatus.CONDITIONING,
    PACKAGED: BatchStatus.PACKAGED,
    PACKAGING: BatchStatus.PACKAGED,
    COMPLETED: BatchStatus.COMPLETED,
};
const toBatchStatus = (raw: unknown): BatchStatus | undefined => {
    const key = String(raw ?? '').toUpperCase().trim();
    if (BATCH_STATUS_MAP[key]) return BATCH_STATUS_MAP[key];
    const n = normalizeText(raw);
    return (Object.values(BatchStatus) as string[]).find(v => normalizeText(v) === n || normalizeText(v).startsWith(n)) as BatchStatus | undefined;
};

const normalizeGravity = (g?: number) => (g !== undefined && g > 2 && g < 1200 && g > 900 ? round(g / 1000, 3) : g);

export const aiActions = {
    // ======================== LECTURA ========================

    getInventoryDetails: ({ filter }: { filter?: string } = {}): ToolResult => {
        const f = normalizeText(filter);
        const items = S().inventory
            .filter(i => !f || normalizeText(i.name).includes(f) || normalizeText(i.type) === f)
            .map(i => ({ name: i.name, type: i.type, stock: round(i.stockAmount, 3), unit: i.unit, costPerUnit: i.costPerUnit, lotNumber: i.lotNumber, purchaseDate: i.purchaseDate }));
        return { count: items.length, inventory: items };
    },

    getActiveBatches: (): ToolResult => ({
        activeBatches: S().batches.filter(b => b.status !== BatchStatus.COMPLETED).map(b => summarizeBatch(b)),
    }),

    getBatchDetails: ({ lotCode }: { lotCode: string }): ToolResult => {
        const r = findBatch(lotCode);
        if (r.error) return { error: r.error };
        return { batch: summarizeBatch(r.item!, true) };
    },

    getBatchHistory: ({ limit = 10 }: { limit?: number } = {}): ToolResult => {
        const list = S().batches
            .filter(b => b.status === BatchStatus.PACKAGED || b.status === BatchStatus.COMPLETED)
            .sort((a, b) => (b.brewDate || '').localeCompare(a.brewDate || ''))
            .slice(0, Math.min(Number(limit) || 10, 30))
            .map(b => summarizeBatch(b));
        return { count: list.length, batches: list };
    },

    getFinancialReport: ({ month }: { month?: string } = {}): ToolResult => {
        const st = S();
        const mk = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKeyOf();
        const sales = st.sales.filter(s => s.date?.startsWith(mk));
        const expenses = st.expenses.filter(e => e.date?.startsWith(mk));
        const income = sales.reduce((s, x) => s + (x.amount || 0), 0);
        const expTotal = expenses.reduce((s, x) => s + (x.amount || 0), 0);
        const byCategory: Record<string, number> = {};
        expenses.forEach(e => { byCategory[e.category] = round((byCategory[e.category] || 0) + e.amount, 0); });
        const byType: Record<string, number> = {};
        sales.forEach(s => { byType[s.type] = round((byType[s.type] || 0) + s.amount, 0); });
        const fixedMonthly = (st.settings.fixedCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
        const closed = st.financialHistory.find(h => h.monthKey === mk);
        return {
            month: mk,
            income: round(income, 0),
            expensesRegistered: round(expTotal, 0),
            fixedCostsConfiguredMonthly: round(fixedMonthly, 0),
            resultBeforeFixed: round(income - expTotal, 0),
            expensesByCategory: byCategory,
            salesByType: byType,
            unpaidSales: sales.filter(s => s.isPaid === false).map(s => ({ date: s.date, amount: s.amount, description: s.description })),
            closedBalance: closed ? { income: closed.income, expenses: closed.expenses, netResult: closed.netResult } : null,
            sales: sales.slice(0, 40).map(s => ({ date: s.date, amount: s.amount, type: s.type, description: s.description, paid: s.isPaid !== false })),
            expenses: expenses.slice(0, 40).map(e => ({ date: e.date, amount: e.amount, category: e.category, description: e.description })),
            history: st.financialHistory.slice(0, 12).map(h => ({ month: h.monthKey, income: h.income, expenses: h.expenses, netResult: h.netResult })),
        };
    },

    getKegsStatus: (): ToolResult => {
        const st = S();
        return {
            kegs: st.kegs.map(k => ({
                id: k.id, size: k.size, currentVolume: k.currentVolume ?? (k.contents ? k.size : 0), status: k.status,
                location: k.currentLocation, contents: k.contents || null, tapped: !!k.isTapped,
                customer: k.customerId ? st.customers.find(c => c.id === k.customerId)?.name : undefined,
                daysWithClient: k.status === 'WITH_CLIENT' && k.dateDispatched ? daysBetween(k.dateDispatched) : undefined,
            })),
        };
    },

    getFermentersStatus: (): ToolResult => {
        const st = S();
        const list = (st.fermenters || []).map(f => {
            const b = st.batches.find(batch => batch.id === f.currentBatchId && batch.status !== BatchStatus.COMPLETED)
                || st.batches.find(batch => batch.fermenterId === f.id && batch.status !== BatchStatus.COMPLETED);
            const logs = b?.fermentationLogs || [];

            return {
                id: f.id,
                name: f.name,
                capacity: f.capacity,
                status: f.status,
                notes: f.notes,
                lastCleanedDate: f.lastCleanedDate,
                currentBatch: b ? {
                    id: b.id,
                    lotCode: b.lotCode,
                    recipeName: b.recipeName,
                    style: b.style,
                    status: b.status,
                    daysInTank: b.brewDate ? daysBetween(b.brewDate) : undefined,
                    originalGravity: b.originalGravity,
                    lastGravity: lastReading(logs, 'gravity'),
                    lastTemperature: lastReading(logs, 'temperature'),
                    volumeFermenter: b.volumeFermenter,
                } : null,
            };
        });
        return {
            total: list.length,
            available: list.filter(f => f.status === 'AVAILABLE').length,
            occupied: list.filter(f => f.status === 'OCCUPIED').length,
            dirty: list.filter(f => f.status === 'DIRTY').length,
            maintenance: list.filter(f => f.status === 'MAINTENANCE').length,
            fermenters: list,
        };
    },

    getBottleStock: (): ToolResult => ({
        bottles: S().bottles.filter(b => b.quantity > 0).map(b => ({ style: b.style, format: b.format, quantity: b.quantity, lotCode: b.lotCode, packagedDate: b.packagedDate })),
    }),

    getRecipes: (): ToolResult => ({
        recipes: S().masterRecipes.map(r => ({
            name: r.name, style: r.style, batchSize: r.batchSize, targetOG: r.targetOG, targetFG: r.targetFG, targetIBU: r.targetIBU, targetColor: r.targetColor, version: r.version,
            ingredients: (r.ingredients || []).map(i => ({ name: i.name, amount: i.amountUsed, unit: i.unit, type: i.type })),
        })),
    }),

    getCustomers: ({ filter }: { filter?: string } = {}): ToolResult => {
        const f = normalizeText(filter);
        return {
            customers: S().customers
                .filter(c => !f || normalizeText(c.name).includes(f))
                .map(c => ({ id: c.id, name: c.name, contact: c.contact, address: c.address, debt: round(c.debt, 0), totalSales: round(c.totalSales || 0, 0) })),
        };
    },

    getCustomerStatement: ({ customer }: { customer: string }): ToolResult => {
        const r = findCustomer(customer);
        if (r.error) return { error: r.error };
        const c = r.item!;
        const st = S();
        return {
            customer: { name: c.name, contact: c.contact, address: c.address, debt: round(c.debt, 0), totalSales: round(c.totalSales || 0, 0) },
            sales: st.sales.filter(s => s.customerId === c.id).slice(0, 30).map(s => ({ date: s.date, amount: s.amount, description: s.description, paid: s.isPaid !== false })),
            payments: st.payments.filter(p => p.customerId === c.id).slice(0, 30).map(p => ({ date: p.date, amount: p.amount, notes: p.notes })),
            kegsWithClient: st.kegs.filter(k => k.customerId === c.id && k.status === 'WITH_CLIENT').map(k => ({ id: k.id, contents: k.contents, since: k.dateDispatched })),
        };
    },

    getCalendarEvents: ({ daysAhead = 7, daysBack = 0, includeCompleted = false }: { daysAhead?: number; daysBack?: number; includeCompleted?: boolean } = {}): ToolResult => {
        const today = localToday();
        const from = addDays(today, -Math.abs(Number(daysBack) || 0));
        const to = addDays(today, Math.abs(Number(daysAhead) || 7));
        const st = S();
        const events = st.calendarEvents
            .filter(e => { const d = e.start?.slice(0, 10); return d >= from && d <= to && (includeCompleted || !e.completed); })
            .sort((a, b) => a.start.localeCompare(b.start))
            .map(e => ({ title: e.title, date: e.start.slice(0, 10), type: e.type, completed: e.completed, notes: e.notes, lotCode: e.batchId ? st.batches.find(b => b.id === e.batchId)?.lotCode : undefined }));
        const overdue = st.calendarEvents.filter(e => !e.completed && e.start?.slice(0, 10) < today).map(e => ({ title: e.title, date: e.start.slice(0, 10), type: e.type }));
        return { today, range: { from, to }, events, overdue: overdue.slice(0, 15) };
    },

    getShoppingList: (): ToolResult => ({
        items: S().shoppingList.map(i => ({ text: i.text, completed: i.completed, estimatedCost: i.estimatedCost })),
    }),

    getDailyBriefing: (): ToolResult => {
        const st = S();
        const today = localToday();
        const in3 = addDays(today, 3);
        const fermenters = st.fermenters || [];
        return {
            today,
            eventsToday: st.calendarEvents.filter(e => !e.completed && e.start?.slice(0, 10) === today).map(e => ({ title: e.title, type: e.type, notes: e.notes })),
            overdueEvents: st.calendarEvents.filter(e => !e.completed && e.start?.slice(0, 10) < today).map(e => ({ title: e.title, date: e.start.slice(0, 10), type: e.type })).slice(0, 10),
            nextDays: st.calendarEvents.filter(e => !e.completed && e.start?.slice(0, 10) > today && e.start.slice(0, 10) <= in3).map(e => ({ title: e.title, date: e.start.slice(0, 10), type: e.type })),

            // Fermentadores y estado de tanques
            dirtyFermenters: fermenters.filter(f => f.status === 'DIRTY').map(f => ({ id: f.id, name: f.name, capacity: f.capacity, notes: f.notes })),
            availableFermenters: fermenters.filter(f => f.status === 'AVAILABLE').map(f => ({ id: f.id, name: f.name, capacity: f.capacity })),
            occupiedFermenters: fermenters.filter(f => f.status === 'OCCUPIED').map(f => {
                const b = st.batches.find(batch => batch.id === f.currentBatchId && batch.status !== BatchStatus.COMPLETED)
                || st.batches.find(batch => batch.fermenterId === f.id && batch.status !== BatchStatus.COMPLETED);
                const s = b ? summarizeBatch(b) : null;
                return {
                    id: f.id,
                    name: f.name,
                    capacity: f.capacity,
                    batch: s ? { lotCode: s.lotCode, recipe: s.recipeName, style: s.style, status: s.status, days: s.daysSinceBrew, lastGravity: s.lastGravityReading, lastTemp: s.lastTemperatureReading } : null,
                };
            }),

            fermenting: st.batches.filter(b => b.status === BatchStatus.FERMENTING || b.status === BatchStatus.CONDITIONING).map(b => {
                const s = summarizeBatch(b);
                return { lotCode: s.lotCode, recipe: s.recipeName, style: s.style, status: s.status, fermenter: s.fermenterName, days: s.daysSinceBrew, originalGravity: s.originalGravity, lastGravity: s.lastGravityReading, lastTemp: s.lastTemperatureReading, lastLogDate: b.fermentationLogs?.slice(-1)[0]?.date };
            }),
            dirtyKegs: st.kegs.filter(k => k.status === 'DIRTY').map(k => k.id),
            kegsOutLong: st.kegs.filter(k => k.status === 'WITH_CLIENT' && k.dateDispatched && daysBetween(k.dateDispatched) > 30).map(k => ({ id: k.id, location: k.currentLocation, days: daysBetween(k.dateDispatched!) })),
            outOfStock: st.inventory.filter(i => i.stockAmount <= 0).map(i => i.name),
            lowStock: st.inventory.filter(i => i.stockAmount > 0 && i.stockAmount <= 5).map(i => ({ name: i.name, stock: i.stockAmount, unit: i.unit })),
            topDebtors: [...st.customers].filter(c => c.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 5).map(c => ({ name: c.name, debt: round(c.debt, 0), contact: c.contact })),
            tappedKegs: st.kegs.filter(k => k.isTapped).map(k => ({ id: k.id, contents: k.contents, litersLeft: round(k.currentVolume ?? k.size, 1) })),
            activeTimers: [...timers.values()].map(t => ({ label: t.label, minutesLeft: Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000)) })),
        };
    },

    generateShoppingList: ({ daysAhead = 30 }: { daysAhead?: number } = {}): ToolResult => {
        const st = S();
        const today = localToday();
        const until = addDays(today, Number(daysAhead) || 30);
        const brews = st.calendarEvents.filter(e => e.type === EventType.BREW && !e.completed && e.start.slice(0, 10) >= today && e.start.slice(0, 10) <= until);
        const needed: Record<string, { amount: number; unit: string; inventoryId?: string }> = {};
        const withoutRecipe: string[] = [];
        brews.forEach(e => {
            const batch = st.batches.find(b => b.id === e.batchId);
            const recipe = st.masterRecipes.find(r => r.id === batch?.recipeId) || st.masterRecipes.find(r => normalizeText(e.title).includes(normalizeText(r.name)));
            if (!recipe) { withoutRecipe.push(e.title); return; }
            recipe.ingredients.forEach(i => {
                const key = i.inventoryId || i.name;
                needed[key] = { amount: (needed[key]?.amount || 0) + i.amountUsed, unit: i.unit, inventoryId: i.inventoryId };
            });
        });
        const missing = Object.entries(needed).map(([key, n]) => {
            const inv = st.inventory.find(i => i.id === n.inventoryId) || st.inventory.find(i => normalizeText(i.name) === normalizeText(key));
            const stock = inv?.stockAmount || 0;
            return { name: inv?.name || key, needed: round(n.amount, 3), stock: round(stock, 3), toBuy: round(Math.max(0, n.amount - stock), 3), unit: inv?.unit || n.unit, estimatedCost: inv ? round(Math.max(0, n.amount - stock) * inv.costPerUnit, 0) : undefined };
        }).filter(m => m.toBuy > 0);
        return { daysAhead, plannedBrews: brews.map(b => ({ title: b.title, date: b.start.slice(0, 10) })), brewsWithoutRecipe: withoutRecipe, toBuy: missing };
    },

    // ======================== ESCRITURA ========================

    updateKegStatus: ({ kegId, status, location, customer }: { kegId: string; status: string; location?: string; customer?: string }): ToolResult => {
        const r = findKeg(kegId);
        if (r.error) return { error: r.error };
        const keg = r.item!;
        const st = String(status || '').toUpperCase() as Keg['status'];
        if (!KEG_STATUSES.includes(st)) return { error: `Estado inválido "${status}". Usá: ${KEG_STATUSES.join(', ')}.` };

        const prev: Partial<Keg> = { status: keg.status, currentLocation: keg.currentLocation, customerId: keg.customerId, dateDispatched: keg.dateDispatched, contents: keg.contents, currentVolume: keg.currentVolume, batchId: keg.batchId, isTapped: keg.isTapped };
        const updates: Partial<Keg> = { status: st };
        if (st === 'WITH_CLIENT') {
            let custName = location;
            if (customer) {
                const c = findCustomer(customer);
                if (c.error) return { error: c.error };
                updates.customerId = c.item!.id;
                custName = c.item!.name;
            }
            updates.currentLocation = custName || keg.currentLocation || 'Cliente';
            updates.dateDispatched = localToday();
            updates.isTapped = false;
        } else if (st === 'DIRTY') {
            Object.assign(updates, { currentLocation: location || 'Lavadero', contents: '', currentVolume: 0, batchId: undefined, customerId: undefined, dateDispatched: undefined, isTapped: false });
        } else {
            Object.assign(updates, { currentLocation: location || 'Cámara de Frío', customerId: undefined, dateDispatched: undefined });
        }
        useBreweryStore.getState().updateKeg(keg.id, updates);
        pushUndo(`estado del barril ${keg.id}`, () => S().updateKeg(keg.id, prev));
        return { success: true, message: `Barril ${keg.id} → ${st}${updates.currentLocation ? ` (${updates.currentLocation})` : ''}` };
    },

    cleanFermenter: ({ fermenterId, notes }: { fermenterId: string; notes?: string }): ToolResult => {
        const r = findFermenter(fermenterId);
        if (r.error) return { error: r.error };
        const ferm = r.item!;
        const prev: Partial<Fermenter> = {
            status: ferm.status,
            notes: ferm.notes,
            lastCleanedDate: ferm.lastCleanedDate,
            currentBatchId: ferm.currentBatchId,
        };
        S().cleanFermenter(ferm.id);
        if (notes) {
            S().updateFermenter(ferm.id, { notes });
        }
        pushUndo(`limpieza del ${ferm.name}`, () => S().updateFermenter(ferm.id, prev));
        return { success: true, message: `${ferm.name} marcado como LIMPIO y DISPONIBLE (CIP realizado).` };
    },

    updateFermenterStatus: ({ fermenterId, status, notes }: { fermenterId: string; status: string; notes?: string }): ToolResult => {
        const r = findFermenter(fermenterId);
        if (r.error) return { error: r.error };
        const ferm = r.item!;
        const st = String(status || '').toUpperCase() as FermenterStatus;
        const VALID: FermenterStatus[] = ['AVAILABLE', 'OCCUPIED', 'DIRTY', 'MAINTENANCE'];
        if (!VALID.includes(st)) {
            return { error: `Estado inválido "${status}". Usá: ${VALID.join(', ')}.` };
        }
        const prev: Partial<Fermenter> = {
            status: ferm.status,
            notes: ferm.notes,
            currentBatchId: ferm.currentBatchId,
            lastCleanedDate: ferm.lastCleanedDate,
        };
        const updates: Partial<Fermenter> = { status: st };
        if (notes !== undefined) updates.notes = notes;
        if (st === 'AVAILABLE') {
            updates.currentBatchId = undefined;
            updates.lastCleanedDate = localToday();
        } else if (st === 'DIRTY') {
            updates.currentBatchId = undefined;
        }
        S().updateFermenter(ferm.id, updates);
        pushUndo(`estado del ${ferm.name}`, () => S().updateFermenter(ferm.id, prev));
        return { success: true, message: `${ferm.name} actualizado a ${st}.` };
    },

    assignBatchToFermenter: ({ fermenterId, lotCode }: { fermenterId: string; lotCode: string }): ToolResult => {
        const rF = findFermenter(fermenterId);
        if (rF.error) return { error: rF.error };
        const ferm = rF.item!;

        const rB = findBatch(lotCode);
        if (rB.error) return { error: rB.error };
        const batch = rB.item!;

        const prevBatches = S().batches;
        const prevFermenters = S().fermenters;

        S().assignBatchToFermenter(ferm.id, batch.id);

        pushUndo(`asignación de ${batch.lotCode} al ${ferm.name}`, () => {
            useBreweryStore.setState({ batches: prevBatches, fermenters: prevFermenters });
        });

        return { success: true, message: `Lote ${batch.lotCode} (${batch.recipeName}) asignado a ${ferm.name}.` };
    },

    updateInventory: ({ ingredientName, amountChange, newAmount }: { ingredientName: string; amountChange?: number; newAmount?: number }): ToolResult => {
        const r = findIngredient(ingredientName);
        if (r.error) return { error: r.error };
        const ing = r.item!;
        const delta = num(amountChange);
        const abs = num(newAmount);
        if (delta === undefined && abs === undefined) return { error: 'Indicá amountChange (+/-) o newAmount.' };
        const prev = ing.stockAmount;
        let next = abs !== undefined ? abs : prev + (delta as number);
        let warning: string | undefined;
        if (next < 0) { warning = `El stock quedaba negativo (${round(next, 3)}), se dejó en 0.`; next = 0; }
        S().updateInventory(ing.id, round(next, 4));
        pushUndo(`stock de ${ing.name}`, () => S().updateInventory(ing.id, prev));
        return { success: true, message: `Stock de ${ing.name}: ${round(prev, 3)} → ${round(next, 3)} ${ing.unit}`, warning };
    },

    editIngredient: ({ ingredientName, costPerUnit, lotNumber, newName, unit }: { ingredientName: string; costPerUnit?: number; lotNumber?: string; newName?: string; unit?: string }): ToolResult => {
        const r = findIngredient(ingredientName);
        if (r.error) return { error: r.error };
        const ing = r.item!;
        const updates: Partial<Ingredient> = {};
        const c = num(costPerUnit);
        if (c !== undefined) updates.costPerUnit = c;
        if (lotNumber) updates.lotNumber = lotNumber;
        if (newName) updates.name = newName;
        if (unit) updates.unit = unit;
        if (!Object.keys(updates).length) return { error: 'No se indicó ningún dato para modificar.' };
        const prev: Partial<Ingredient> = { costPerUnit: ing.costPerUnit, lotNumber: ing.lotNumber, name: ing.name, unit: ing.unit };
        S().editIngredient(ing.id, updates);
        pushUndo(`edición de ${ing.name}`, () => S().editIngredient(ing.id, prev));
        return { success: true, message: `Insumo ${ing.name} actualizado`, updates };
    },

    addIngredient: (a: { name: string; type: string; stockAmount: number; unit: string; costPerUnit: number; lotNumber?: string }): ToolResult => {
        if (!a.name) return { error: 'Falta el nombre del insumo.' };
        const exists = S().inventory.find(i => normalizeText(i.name) === normalizeText(a.name));
        if (exists) return { error: `Ya existe "${exists.name}". Para sumar stock usá update_inventory.` };
        const type = String(a.type || '').toUpperCase() as Ingredient['type'];
        if (!INGREDIENT_TYPES.includes(type)) return { error: `Tipo inválido. Usá: ${INGREDIENT_TYPES.join(', ')}.` };
        const stock = num(a.stockAmount), cost = num(a.costPerUnit);
        if (stock === undefined || cost === undefined || !a.unit) return { error: 'Faltan stockAmount, unit o costPerUnit.' };
        const ing: Ingredient = { id: crypto.randomUUID(), name: a.name, type, stockAmount: stock, unit: a.unit, costPerUnit: cost, purchaseDate: localToday(), lotNumber: a.lotNumber || '' };
        S().addIngredient(ing);
        pushUndo(`alta de ${ing.name}`, () => S().deleteIngredient(ing.id));
        return { success: true, message: `Insumo ${ing.name} creado (${stock} ${a.unit}). Se registró el gasto de compra por $${round(stock * cost, 0)}.` };
    },

    updateBatchStatus: ({ lotCode, status, volumePackaged }: { lotCode: string; status: string; volumePackaged?: number }): ToolResult => {
        const r = findBatch(lotCode);
        if (r.error) return { error: r.error };
        const batch = r.item!;
        const newStatus = toBatchStatus(status);
        if (!newStatus) return { error: `Estado inválido "${status}". Usá: ${Object.keys(BATCH_STATUS_MAP).join(', ')}.` };
        const vol = num(volumePackaged);
        if (newStatus === BatchStatus.PACKAGED && !vol && !batch.volumePackaged) {
            return { error: `Para pasar ${batch.lotCode} a Finalizado necesito los litros finales envasados (volumePackaged). Preguntaselo al usuario.` };
        }
        const prevStatus = batch.status;
        const updates: Record<string, any> = { status: newStatus };
        if (vol) updates.volumePackaged = vol;
        if (newStatus === BatchStatus.PACKAGED) {
            updates.packagedDate = localToday();
            if (!vol) updates.volumePackaged = batch.volumePackaged;
        }
        S().updateBatch(batch.id, updates);
        pushUndo(`estado del lote ${batch.lotCode}`, () => S().updateBatch(batch.id, { status: prevStatus }));
        return { success: true, message: `Lote ${batch.lotCode} (${batch.recipeName}): ${prevStatus} → ${newStatus}` };
    },

    addFermentationLog: (a: { lotCode: string; action?: string; gravity?: number; temperature?: number; notes?: string; date?: string }): ToolResult => {
        const r = findBatch(a.lotCode);
        if (r.error) return { error: r.error };
        const batch = r.item!;
        const action = (String(a.action || 'MEDICION').toUpperCase()) as FermentationLog['action'];
        if (!FERMENTATION_ACTIONS.includes(action!)) return { error: `Acción inválida. Usá: ${FERMENTATION_ACTIONS.join(', ')}.` };
        const gravity = normalizeGravity(num(a.gravity));
        const temperature = num(a.temperature);
        if (gravity === undefined && temperature === undefined && !a.notes) return { error: 'Indicá al menos densidad, temperatura o una nota.' };
        const before = new Set((batch.fermentationLogs || []).map(l => l.id));
        S().addFermentationLog(batch.id, { date: a.date || localToday(), action, gravity, temperature, notes: a.notes });
        const added = S().batches.find(b => b.id === batch.id)?.fermentationLogs.find(l => !before.has(l.id));
        if (added) pushUndo(`registro de fermentación de ${batch.lotCode}`, () => S().deleteFermentationLog(batch.id, added.id));
        return { success: true, message: `Registro en ${batch.lotCode}: ${[gravity && `densidad ${gravity}`, temperature !== undefined && `${temperature}°C`, a.notes].filter(Boolean).join(', ')}` };
    },

    addQualityLog: (a: { lotCode: string; type: string; value: string | number; unit?: string; notes?: string; technician?: string }): ToolResult => {
        const r = findBatch(a.lotCode);
        if (r.error) return { error: r.error };
        const batch = r.item!;
        const type = String(a.type || '').toUpperCase() as QualityLog['type'];
        if (!QUALITY_TYPES.includes(type)) return { error: `Tipo inválido. Usá: ${QUALITY_TYPES.join(', ')}.` };
        if (a.value === undefined || a.value === '') return { error: 'Falta el valor medido.' };
        const before = new Set((batch.qualityLogs || []).map(l => l.id));
        S().addQualityLog(batch.id, { date: localToday(), type, value: a.value, unit: a.unit, notes: a.notes, technician: a.technician });
        const added = S().batches.find(b => b.id === batch.id)?.qualityLogs?.find(l => !before.has(l.id));
        if (added) pushUndo(`control de calidad de ${batch.lotCode}`, () => S().deleteQualityLog(batch.id, added.id));
        return { success: true, message: `Control ${type} = ${a.value}${a.unit ? ' ' + a.unit : ''} en ${batch.lotCode}` };
    },

    fillKegFromBatch: ({ kegId, lotCode, liters, confirmClean }: { kegId: string; lotCode: string; liters?: number; confirmClean?: boolean }): ToolResult => {
        const k = findKeg(kegId);
        if (k.error) return { error: k.error };
        const b = findBatch(lotCode);
        if (b.error) return { error: b.error };
        const keg = k.item!, batch = b.item!;
        if (keg.contents && (keg.currentVolume ?? keg.size) > 0.5) return { error: `El barril ${keg.id} ya tiene ${keg.contents}. Vacialo/lavalo primero.` };
        if (keg.status === 'DIRTY' && !confirmClean) return { error: `El barril ${keg.id} figura SUCIO. Confirmá con el usuario que ya está limpio y volvé a llamar con confirmClean=true.` };
        if (keg.status === 'WITH_CLIENT') return { error: `El barril ${keg.id} figura en manos de un cliente (${keg.currentLocation}).` };
        const available = batch.volumeAvailable !== undefined ? batch.volumeAvailable : batch.volumePackaged;
        if (!available || available <= 0) return { error: `El lote ${batch.lotCode} no tiene litros disponibles (¿está Finalizado y con volumen cargado?).` };
        const prevKeg: Partial<Keg> = { ...keg };
        const prevBatch = { volumeAvailable: batch.volumeAvailable, status: batch.status };
        S().fillKegFromBatch(keg.id, batch.id, num(liters));
        const after = S().kegs.find(x => x.id === keg.id);
        pushUndo(`llenado del barril ${keg.id}`, () => { S().updateKeg(keg.id, prevKeg); S().updateBatch(batch.id, prevBatch); });
        return { success: true, message: `Barril ${keg.id} llenado con ${round(after?.currentVolume || 0, 1)} L de ${batch.recipeName} (${batch.lotCode}). Quedan ${round(Math.max(0, available - (after?.currentVolume || 0)), 1)} L en el lote.` };
    },

    tapKeg: ({ kegId, tapped = true }: { kegId: string; tapped?: boolean }): ToolResult => {
        const r = findKeg(kegId);
        if (r.error) return { error: r.error };
        const keg = r.item!;
        if (tapped && !keg.contents) return { error: `El barril ${keg.id} está vacío.` };
        const prev = !!keg.isTapped;
        S().toggleKegTap(keg.id, !!tapped);
        pushUndo(`canilla del barril ${keg.id}`, () => S().toggleKegTap(keg.id, prev));
        return { success: true, message: `Barril ${keg.id} ${tapped ? 'pinchado' : 'despinchado'}` };
    },

    serveFromTap: ({ kegId, liters, formatName, price }: { kegId: string; liters: number; formatName: string; price: number }): ToolResult => {
        const r = findKeg(kegId);
        if (r.error) return { error: r.error };
        const keg = r.item!;
        const l = num(liters), p = num(price);
        if (!l || p === undefined) return { error: 'Faltan litros o precio.' };
        if (!keg.contents) return { error: `El barril ${keg.id} está vacío.` };
        const prevKeg: Partial<Keg> = { ...keg };
        const beforeSales = new Set(S().sales.map(s => s.id));
        S().serveFromTap(keg.id, l, formatName || `${l}L`, p);
        const sale = S().sales.find(s => !beforeSales.has(s.id));
        pushUndo(`venta de canilla del barril ${keg.id}`, () => { if (sale) S().deleteSale(sale.id); S().updateKeg(keg.id, prevKeg); });
        const after = S().kegs.find(x => x.id === keg.id);
        return { success: true, message: `Servido ${formatName || l + 'L'} del barril ${keg.id} por $${p}. Quedan ${round(after?.currentVolume || 0, 1)} L.` };
    },

    giftFromTap: ({ kegId, liters, formatName }: { kegId: string; liters: number; formatName: string }): ToolResult => {
        const r = findKeg(kegId);
        if (r.error) return { error: r.error };
        const keg = r.item!;
        const l = num(liters);
        if (!l) return { error: 'Faltan los litros.' };
        if (!keg.contents) return { error: `El barril ${keg.id} está vacío.` };
        const prevKeg: Partial<Keg> = { ...keg };
        const beforeExp = new Set(S().expenses.map(e => e.id));
        S().giftFromTap(keg.id, l, formatName || `${l}L`);
        const exp = S().expenses.find(e => !beforeExp.has(e.id));
        pushUndo(`regalo de canilla del barril ${keg.id}`, () => { if (exp) S().deleteExpense(exp.id); S().updateKeg(keg.id, prevKeg); });
        return { success: true, message: `Regalo registrado: ${formatName || l + 'L'} del barril ${keg.id} (costo $${round(exp?.amount || 0, 0)}).` };
    },

    updateBottleStock: ({ bottle, quantityChange }: { bottle: string; quantityChange: number }): ToolResult => {
        const r = findBottle(bottle);
        if (r.error) return { error: r.error };
        const b = r.item!;
        const q = num(quantityChange);
        if (!q) return { error: 'Falta quantityChange.' };
        if (b.quantity + q < 0) return { error: `Solo hay ${b.quantity} unidades de ${b.style} (${b.format}).` };
        S().updateBottleStock(b.id, q);
        pushUndo(`stock de botellas ${b.style}`, () => S().updateBottleStock(b.id, -q));
        return { success: true, message: `${b.style} (${b.format}): ${b.quantity} → ${b.quantity + q} unidades` };
    },

    giftBottle: ({ bottle, quantity }: { bottle: string; quantity: number }): ToolResult => {
        const r = findBottle(bottle);
        if (r.error) return { error: r.error };
        const b = r.item!;
        const q = num(quantity);
        if (!q || q <= 0) return { error: 'Falta la cantidad.' };
        if (q > b.quantity) return { error: `Solo hay ${b.quantity} unidades de ${b.style} (${b.format}).` };
        S().giftBottle(b.id, q);
        return { success: true, message: `Regalo de ${q}x ${b.style} (${b.format}) registrado como gasto REGALO.` };
    },

    addSale: (a: { amount: number; description: string; type: string; customer?: string; isPaid?: boolean; quantity?: number; lotCode?: string }): ToolResult => {
        const amount = num(a.amount);
        if (!amount || amount <= 0) return { error: 'Falta un monto válido.' };
        const type = String(a.type || '').toUpperCase();
        if (!['KEG', 'BOTTLE', 'TAPROOM'].includes(type)) return { error: 'Tipo inválido. Usá KEG, BOTTLE o TAPROOM.' };
        let customerId: string | undefined, customerName: string | undefined;
        if (a.customer) {
            const c = findCustomer(a.customer);
            if (c.error) return { error: c.error };
            customerId = c.item!.id; customerName = c.item!.name;
        }
        let lotCode: string | undefined;
        if (a.lotCode) {
            const b = findBatch(a.lotCode);
            if (!b.error) lotCode = b.item!.lotCode;
        }
        const isPaid = a.isPaid !== undefined ? !!a.isPaid : !customerId;
        const id = crypto.randomUUID();
        S().addSale({ id, amount, description: a.description || 'Venta', type: type as any, customerId, isPaid, quantity: num(a.quantity), lotCode, date: localToday() });
        pushUndo(`venta de $${amount}`, () => S().deleteSale(id));
        return { success: true, message: `Venta de $${amount}${customerName ? ` a ${customerName}` : ''} (${isPaid ? 'cobrada' : 'a cuenta corriente'})` };
    },

    addPayment: ({ customer, amount, notes }: { customer: string; amount: number; notes?: string }): ToolResult => {
        const c = findCustomer(customer);
        if (c.error) return { error: c.error };
        const amt = num(amount);
        if (!amt || amt <= 0) return { error: 'Falta un monto válido.' };
        const prevDebt = c.item!.debt;
        S().addPayment({ id: crypto.randomUUID(), customerId: c.item!.id, amount: amt, notes: notes || 'Pago cargado por el asistente IA', date: localToday() });
        return { success: true, message: `Pago de $${amt} de ${c.item!.name}. Deuda: $${round(prevDebt, 0)} → $${round(Math.max(0, prevDebt - amt), 0)}`, note: 'Los pagos no se pueden deshacer desde el asistente.' };
    },

    addExpense: ({ description, amount, category }: { description: string; amount: number; category: string }): ToolResult => {
        const amt = num(amount);
        if (!amt || amt <= 0) return { error: 'Falta un monto válido.' };
        const cat = String(category || '').toUpperCase() as Expense['category'];
        if (!EXPENSE_CATEGORIES.includes(cat)) return { error: `Categoría inválida. Usá: ${EXPENSE_CATEGORIES.join(', ')}.` };
        const id = crypto.randomUUID();
        S().addExpense({ id, description: description || 'Gasto', amount: amt, category: cat, date: localToday() });
        pushUndo(`gasto de $${amt}`, () => S().deleteExpense(id));
        return { success: true, message: `Gasto de $${amt} (${cat}): ${description}` };
    },

    addCustomer: ({ name, contact, address, debt }: { name: string; contact?: string; address?: string; debt?: number }): ToolResult => {
        if (!name) return { error: 'Falta el nombre.' };
        const exists = S().customers.find(c => normalizeText(c.name) === normalizeText(name));
        if (exists) return { error: `Ya existe el cliente "${exists.name}".` };
        const id = crypto.randomUUID();
        S().addCustomer({ id, name, contact: contact || '', address: address || '', debt: num(debt) || 0, totalSales: 0 });
        pushUndo(`alta del cliente ${name}`, () => S().deleteCustomer(id));
        return { success: true, message: `Cliente ${name} creado.` };
    },

    updateCustomer: ({ customer, name, contact, address, debt }: { customer: string; name?: string; contact?: string; address?: string; debt?: number }): ToolResult => {
        const c = findCustomer(customer);
        if (c.error) return { error: c.error };
        const cust = c.item!;
        const updates: Record<string, any> = {};
        if (name) updates.name = name;
        if (contact !== undefined) updates.contact = contact;
        if (address !== undefined) updates.address = address;
        const d = num(debt);
        if (d !== undefined) updates.debt = d;
        if (!Object.keys(updates).length) return { error: 'No se indicó ningún dato para modificar.' };
        const prev = { name: cust.name, contact: cust.contact, address: cust.address, debt: cust.debt };
        S().updateCustomer(cust.id, updates);
        pushUndo(`edición del cliente ${cust.name}`, () => S().updateCustomer(cust.id, prev));
        return { success: true, message: `Cliente ${cust.name} actualizado.`, updates };
    },

    addCalendarEvent: ({ title, date, type, notes, lotCode }: { title: string; date: string; type?: string; notes?: string; lotCode?: string }): ToolResult => {
        if (!title) return { error: 'Falta el título.' };
        if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return { error: 'Falta la fecha en formato YYYY-MM-DD (calculala a partir de la fecha actual).' };
        const evType = (Object.values(EventType) as string[]).includes(String(type).toUpperCase()) ? String(type).toUpperCase() as EventType : EventType.CUSTOM;
        let batchId: string | undefined;
        if (lotCode) {
            const b = findBatch(lotCode);
            if (b.error) return { error: b.error };
            batchId = b.item!.id;
        }
        const id = crypto.randomUUID();
        S().addCalendarEvent({ id, title, start: date.slice(0, 10), type: evType, completed: false, notes, batchId });
        pushUndo(`evento "${title}"`, () => S().deleteCalendarEvent(id));
        return { success: true, message: `Evento "${title}" agendado para el ${date.slice(0, 10)} (${evType})` };
    },

    completeCalendarEvent: ({ event }: { event: string }): ToolResult => {
        const today = localToday();
        const pending = S().calendarEvents.filter(e => !e.completed);
        const r = resolveOne(pending, event, e => [e.title, `${e.title} ${e.start.slice(0, 10)}`], 'evento pendiente', { prefer: e => e.start.slice(0, 10) <= today });
        if (r.error) return { error: r.error };
        const ev = r.item!;
        S().updateCalendarEvent(ev.id, { completed: true });
        pushUndo(`evento "${ev.title}" completado`, () => S().updateCalendarEvent(ev.id, { completed: false }));
        return { success: true, message: `Evento "${ev.title}" (${ev.start.slice(0, 10)}) marcado como hecho.` };
    },

    addToShoppingList: ({ text, estimatedCost }: { text: string; estimatedCost?: number }): ToolResult => {
        if (!text) return { error: 'Falta qué agregar.' };
        const before = new Set(S().shoppingList.map(i => i.id));
        S().addShoppingItem(text, num(estimatedCost));
        const added = S().shoppingList.find(i => !before.has(i.id));
        if (added) pushUndo(`"${text}" en la lista de compras`, () => S().deleteShoppingItem(added.id));
        return { success: true, message: `Agregado a la lista de compras: ${text}` };
    },

    undoLastAction: (): ToolResult => {
        const last = undoStack.pop();
        if (!last) return { error: 'No hay acciones recientes del asistente para deshacer.' };
        try {
            last.undo();
            return { success: true, message: `Deshecho: ${last.label}` };
        } catch (e) {
            return { error: `No se pudo deshacer ${last.label}: ${String(e)}` };
        }
    },

    // ======================== APP ========================

    navigateTo: ({ section }: { section: string }): ToolResult => {
        const key = normalizeText(section);
        const view = NAV_MAP[key] || Object.entries(NAV_MAP).find(([k]) => key.includes(k))?.[1];
        if (!view) return { error: `No conozco la sección "${section}". Opciones: ${Object.keys(NAV_MAP).join(', ')}` };
        window.dispatchEvent(new CustomEvent(AI_EVENTS.NAVIGATE, { detail: { view } }));
        return { success: true, message: `Abriendo ${section}` };
    },

    setTimer: ({ minutes, label }: { minutes: number; label?: string }): ToolResult => {
        const m = num(minutes);
        if (!m || m <= 0 || m > 24 * 60) return { error: 'Indicá minutos válidos (1 a 1440).' };
        const id = crypto.randomUUID();
        const name = label || `${m} minutos`;
        const handle = setTimeout(() => {
            timers.delete(id);
            notify('⏰ BON — Timer', name);
            window.dispatchEvent(new CustomEvent(AI_EVENTS.TIMER_DONE, { detail: { label: name } }));
        }, m * 60000);
        timers.set(id, { id, label: name, endsAt: Date.now() + m * 60000, handle });
        return { success: true, message: `Timer "${name}" en ${m} min` };
    },

    cancelTimer: ({ label }: { label?: string }): ToolResult => {
        const list = [...timers.values()];
        if (!list.length) return { error: 'No hay timers activos.' };
        const target = label ? list.find(t => normalizeText(t.label).includes(normalizeText(label))) : list[list.length - 1];
        if (!target) return { error: `No encontré un timer "${label}". Activos: ${list.map(t => t.label).join(', ')}` };
        clearTimeout(target.handle);
        timers.delete(target.id);
        return { success: true, message: `Timer "${target.label}" cancelado` };
    },

    getTimers: (): ToolResult => ({
        timers: [...timers.values()].map(t => ({ label: t.label, minutesLeft: Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000)) })),
    }),
};

export type AiActions = typeof aiActions;
