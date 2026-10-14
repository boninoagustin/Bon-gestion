

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  PRODUCTION = 'PRODUCTION',
  INVENTORY = 'INVENTORY',
  PACKAGING = 'PACKAGING', // Unified View
  CALCULATORS = 'CALCULATORS',
  AI_CONSULTANT = 'AI_CONSULTANT',
  CRM = 'CRM', // New Module
  RECIPES = 'RECIPES', // New
  CALENDAR = 'CALENDAR', // New
  BREW_ASSISTANT = 'BREW_ASSISTANT' // New: Asistente de Cocción
}

export enum BatchStatus {
  PLANNED = 'Planificado',
  MASHING = 'Macerado/Hervor',
  FERMENTING = 'Fermentando',
  CONDITIONING = 'Madurando',
  PACKAGED = 'Finalizado',
  COMPLETED = 'Agotado/Historial'
}

export enum EventType {
  BREW = 'BREW',
  FERMENTATION_END = 'FERMENTATION_END',
  MATURATION_START = 'MATURATION_START',
  PACKAGING = 'PACKAGING',
  MAINTENANCE = 'MAINTENANCE',
  DELIVERY = 'DELIVERY',
  CLEANING = 'CLEANING',
  CUSTOM = 'CUSTOM'
}

export interface CalendarEvent {
  id: string;
  batchId?: string; // Optional link to a batch
  title: string;
  start: string; // ISO start date/time
  end?: string; // ISO end date/time
  type: EventType;
  completed: boolean;
  notes?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  type: 'MALT' | 'HOP' | 'YEAST' | 'ADJUNCT' | 'CHEMICAL' | 'PACKAGING';
  stockAmount: number;
  unit: string;
  costPerUnit: number; // Current replacement cost (market value)
  purchaseDate: string; // For FIFO
  lotNumber: string;
}

// Used inside a Batch
export interface BatchIngredient {
  inventoryId: string;
  name: string;
  amountUsed: number;
  costAtTime: number; // Snapshot of cost when batch was created
  unit: string;
  type: Ingredient['type']; // Added for efficiency calculation
}

export interface MasterRecipe {
  id: string;
  name: string;
  style: string;
  batchSize: number; // Kettle volume this recipe is based on
  ingredients: BatchIngredient[];
  targetOG: number;
  targetFG: number;
  targetIBU?: number; // NEW: for BJCP validation
  targetColor?: number; // NEW: for BJCP validation (SRM)
  notes?: string;
  version?: number; // NEW: Version number
  parentId?: string; // NEW: Link to group versions
}

export interface CostItem {
  id: string;
  name: string;
  amount: number;
}

export interface BrewerySettings {
  fixedCosts: CostItem[]; // Detailed list of monthly costs
  targetMonthlyVolume?: number; // New: Target volume for stable overhead calculation
  fermenterCapacity?: number; // Total number of fermenters in the plant
  apiKey?: string; // User provided Gemini API Key
  aiProvider?: 'gemini' | 'chatgpt'; // AI Provider choice
  chatGptModel?: string; // ChatGPT model choice
  currency?: string; // Currency code: ARS, USD, EUR, etc.
  aiPersonality?: string; // Persona for the AI
  aiLongTermMemory?: string; // Long-term preferences/rules
  equipmentVolume?: number; // NEW: global equipment profile volume (L)
  equipmentEfficiency?: number; // NEW: global equipment profile efficiency (%)
  equipmentBoilOff?: number; // NEW: global equipment profile boil-off rate (L/h)
  equipmentLosses?: number; // NEW: global equipment profile dead space / losses (L)
}


export interface Customer {
  id: string;
  name: string;
  contact?: string;
  address?: string;
  debt: number; // Current Account Balance (Positive = They owe us)
  totalSales?: number; // Lifetime value
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface Sale {
  id: string;
  amount: number;
  date: string;
  description: string; // e.g. "Cobro Barril #K001 - Bar X"
  type: 'KEG' | 'BOTTLE' | 'TAPROOM';
  quantity?: number;
  format?: string;
  lotCode?: string; // CRITICAL: For profitability tracking
  customerId?: string; // Link to CRM
  isPaid?: boolean; // If false, it goes to debt
  isClosed?: boolean; // If true, this sale belongs to a closed month and shouldn't appear in current dashboard stats
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: 'INVENTORY' | 'FIXED' | 'MAINTENANCE' | 'MARKETING' | 'LOGISTICS' | 'ADMIN' | 'OTHER' | 'REGALO';
  isClosed?: boolean; // If true, this expense belongs to a closed month
  inventoryPurchaseId?: string; // Link to an inventory purchase for accurate deletion
}

export interface ShoppingListItem {
  id: string;
  text: string;
  completed: boolean;
  estimatedCost?: number;
}

export interface MonthlyBalance {
  id: string;
  monthKey: string; // "YYYY-MM"
  income: number;
  expenses: number; // Fixed + Inventory Purchases + Variable Expenses
  netResult: number;
  isClosed: boolean;
  closedDate?: string;
  fixedCostsSnapshot?: CostItem[]; // Snapshot of fixed costs for this month
}

export interface FermentationLog {
  id: string;
  date: string;
  action?: 'MEDICION' | 'DRY_HOP' | 'CLARIFICANTE' | 'PURGA' | 'TRASIEGO' | 'OTRO';
  gravity?: number;
  temperature?: number;
  notes?: string;
}

export interface Appearance {
  color: 'Pálido' | 'Ámbar' | 'Cobrizo' | 'Marrón' | 'Negro';
  clarity: 'Brillante' | 'Nebulosa' | 'Turbia' | 'Opaca';
  foam: {
    formation: string;
    retention: string;
    texture: string;
    adherence: string;
  };
  score: number; // 1-5
}

export interface Aroma {
  malt: string; // Grano, pan, caramelo...
  hops: string; // Cítrico, floral...
  yeast: string; // Ésteres, fenoles...
  score: number; // 1-5
}

export interface Flavor {
  malt: string;
  hops: string;
  balance: string;
  aftertaste: string;
  score: number; // 1-5
}

export interface Mouthfeel {
  body: 'Ligero/Aguado' | 'Medio' | 'Pleno/Denso';
  carbonation: 'Baja/Plana' | 'Media' | 'Alta/Punzante';
  texture: string; // Cremosa, sedosa...
  warming: string; // Alcohol...
  score: number; // 1-5
}

export interface SensoryProfile {
  id: string;
  date: string;
  evaluator: string;

  // Sections
  appearance: Appearance;
  aroma: Aroma;
  flavor: Flavor;
  mouthfeel: Mouthfeel;

  // Overall
  overallScore: number; // Average

  // Defects
  defects: string[]; // List of specific off-flavors

  notes?: string;
}

export interface QualityLog {
  id: string;
  date: string;
  type: 'PH' | 'GRAVITY' | 'TEMPERATURE' | 'CARBONATION' | 'SENSORY' | 'LAB_ANALYSIS';
  value: string | number;
  unit?: string;
  notes?: string;
  technician?: string;
}

export interface Batch {
  id: string;
  recipeName: string;
  recipeId?: string; // NEW: Link to a master recipe
  recipeVersion?: number; // NEW: The version of the recipe used
  style: string;
  brewDate: string;
  status: BatchStatus;

  // Volumes for Efficiency Tracking
  volumeKettle: number; // Liters in Kettle (e.g., 300L)
  volumeFermenter: number; // Liters into Fermenter (e.g., 250L)
  volumePackaged: number; // Final Liters (e.g., 230L)
  volumeAvailable?: number; // Balance remaining after filling kegs

  // Financials
  ingredientsUsed: BatchIngredient[]; // List of ingredients from inventory
  totalIngredientsCost: number;
  overheadCost: number; // Fixed + Variable allocated

  // Metrics
  originalGravity: number;
  finalGravity: number;

  // Traceability
  lotCode: string;
  packagedDate?: string; // ISO date when moved to packaged state

  // NEW: Fermentation Tracking
  fermentationLogs: FermentationLog[];

  // NEW: Quality Control
  sensoryProfiles?: SensoryProfile[];
  qualityLogs?: QualityLog[];

  // General notes / observations
  notes?: string;
  ingredientsDiscounted?: boolean; // NEW: Flag to prevent double deduction
  fermenterId?: string; // Link to assigned fermenter
  fermenterName?: string; // Cache fermenter name for fast UI display
}

export type FermenterStatus = 'AVAILABLE' | 'OCCUPIED' | 'DIRTY' | 'MAINTENANCE';

export interface Fermenter {
  id: string; // e.g. "F-1", "f_123"
  name: string; // "Fermentador 1", "F-01"
  capacity: number; // Volume in Liters (e.g. 300)
  status: FermenterStatus;
  currentBatchId?: string; // Link to active batch
  notes?: string;
  lastCleanedDate?: string; // ISO date of last CIP/cleaning
}

export interface Keg {
  id: string; // Asset ID (e.g., #045)
  size: number; // 20, 30, 50L
  currentVolume?: number; // Amount remaining inside. If undefined, assumes full (equal to size)
  status: 'IN_HOUSE' | 'WITH_CLIENT' | 'DIRTY';
  currentLocation: string; // "Cámara de Frío" or Client Name
  customerId?: string; // Link to CRM customer when dispatched
  dateDispatched?: string; // ISO Date
  dispatchedPrice?: number; // Price at which it was dispatched (Debt amount)
  contents?: string; // Beer Name for display
  batchId?: string; // Link to specific batch for inventory deduction
  isTapped?: boolean; // Tapped in Taproom
}

export interface BottleStock {
  id: string;
  style: string;
  format: string; // Changed to string to support "Pinta 500ml", "Botella 1L", etc.
  quantity: number; // Count
  packagedDate: string; // ISO Date
  lotCode?: string; // CRITICAL: For profitability tracking
  notes?: string;
}

// --- BREW ASSISTANT TYPES --- //

export enum BrewStep {
  PREPARATION = 'PREPARATION',
  WATER_HEATING = 'WATER_HEATING',
  MASH_IN = 'MASH_IN',
  MASHING = 'MASHING',
  MASH_OUT = 'MASH_OUT',
  SPARGING = 'SPARGING',
  BOILING = 'BOILING',
  WHIRLPOOL = 'WHIRLPOOL',
  COOLING = 'COOLING',
  TRANSFER = 'TRANSFER',
  YEAST_PITCH = 'YEAST_PITCH'
}

export interface TimerLog {
  id: string;
  stepId: BrewStep | 'GLOBAL' | 'MASH_RECIRCULATION' | 'MASH_SPARGE' | string; // Allow dynamic IDs for Hop Timers like 'HOP_15'
  startTime: number; // timestamp
  endTime?: number;  // timestamp
  durationMs?: number; // total duration
  notes?: string;
  isPaused?: boolean;
  accumulatedMs?: number; // Para poder pausar y reanudar
}

export interface BrewSession {
  id: string; // Unique ID for the session
  batchId: string; // Link to the Production Batch
  recipeId?: string; // Link to the Master Recipe (for fetching targets)
  startTime: number; // Global start timestamp
  endTime?: number; // Global end timestamp
  globalElapsed?: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  currentStep: BrewStep;
  timers: TimerLog[]; // All timers (global, steps, specific sub-timers)
  metrics: {
    coldSteeping: { done: boolean; grainKg: number; waterL: number; notes: string };
    milling: { grainsWeighed: any[]; totalGrainReal: number; waterTreated: boolean; notes: string };
    heating: { waterVolume: number; strikeTemp: number; actualWaterTemp: number; notes: string };
    mashIn: { targetTemp: number; actualTemp: number; notes: string };
    saccharification: { tempReadings: any[]; iodineTest: string; spargeWaterReminder: boolean; pH: number; notes: string };
    mashOut: { targetTemp: number; actualTemp: number; notes: string };
    lautering: { 
      vorlauf: { wortClear: boolean; notes: string };
      sparge: { waterVolume: number; waterTemp: number; fwhDone: boolean; volumeCollected: number; preBoilGravity: number; notes: string };
    };
    boil: { additions: any[]; postBoilVolume: number; notes: string };
    whirlpool: { tempAtAddition: number; hopsAdded: any[]; notes: string };
    cooling: { startTemp: number; targetTemp: number; actualTemp: number; method: string; volumeToFermenter: number; notes: string };
    preFermentation: { og: number; efficiencyCalc: number; finalVolume: number };
    pitching: { yeastName: string; yeastAmount: number; yeastUnit: string; rehydrated: boolean; oxygenation: boolean; wortTemp: number; fermenterSealed: boolean; airlockInstalled: boolean; chamberTemp: number; notes: string };
  };
  ingredientsChecklist?: Record<string, boolean>; // NEW: Ingredient Checklist state
  notes: string[]; // General session logs
  lastUpdatedAt: number; // To handle reloads
  activeStepIndex?: number; // Persisted active step tab
  alarmMuted?: boolean; // Mute alarm sounds
}
