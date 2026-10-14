

import { Batch, BatchStatus, Customer, Ingredient, Keg, ViewState } from "./types";

export const APP_NAME = "BON Gestion";

// Mock Inventory - Demonstrating FIFO tracking
export const MOCK_INVENTORY: Ingredient[] = [];

// Mock Batches - Showing the Volume Drop (Merma) reality
export const MOCK_BATCHES: Batch[] = [];

export const MOCK_KEGS: Keg[] = [];

export const MENU_ITEMS = [
  { id: ViewState.DASHBOARD, label: 'Panel de Control', icon: 'LayoutDashboard' },
  { id: ViewState.PRODUCTION, label: 'Producción', icon: 'Factory' },
  { id: ViewState.RECIPES, label: 'Recetas', icon: 'BookOpen' },
  { id: ViewState.CALENDAR, label: 'Calendario', icon: 'Calendar' },
  { id: ViewState.INVENTORY, label: 'Inventario', icon: 'Package' },
  { id: ViewState.PACKAGING, label: 'Envasado', icon: 'Beer' },
  { id: ViewState.CRM, label: 'Clientes', icon: 'Users' },
  { id: ViewState.CALCULATORS, label: 'Calculadoras', icon: 'Calculator' },
  { id: ViewState.AI_CONSULTANT, label: 'BrewMaster AI', icon: 'Bot' },
];