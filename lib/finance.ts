import { CostItem, Expense, Sale } from '../types';

export interface MonthNetStats {
  income: number;
  incomePaid: number;
  incomeDebt: number;
  expenses: number;
  net: number;
}

export interface MonthForecast {
  elapsedDays: number;
  totalDays: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedNet: number;
}

export const getLocalMonthKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

export const getLocalDateString = (date: Date): string => {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Helper: safely parses a monetary amount, returning 0 for invalid values.
 */
const safeAmount = (val: unknown): number =>
  typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;

export const calculateMonthNet = (
  monthKey: string,
  sales: Sale[],
  expenses: Expense[],
  fixedCosts: CostItem[]
): MonthNetStats => {
  const monthSales = sales.filter(s => s.date.startsWith(monthKey) && !s.isClosed);
  const incomePaid = monthSales.filter(s => s.isPaid).reduce((sum, s) => sum + safeAmount(s.amount), 0);
  const incomeDebt = monthSales.filter(s => !s.isPaid).reduce((sum, s) => sum + safeAmount(s.amount), 0);
  const income = incomePaid + incomeDebt;

  const allExpenses = expenses.filter(e => e.date.startsWith(monthKey) && !e.isClosed);
  const inventory = allExpenses.filter(e => e.category === 'INVENTORY').reduce((sum, e) => sum + safeAmount(e.amount), 0);
  const variable = allExpenses
    .filter(e => e.category !== 'INVENTORY' && e.category !== 'FIXED')
    .reduce((sum, e) => sum + safeAmount(e.amount), 0);
  const fixed = (fixedCosts || []).reduce((sum, item) => sum + safeAmount(item.amount), 0);
  const expenseTotal = inventory + variable + fixed;

  return {
    income,
    incomePaid,
    incomeDebt,
    expenses: expenseTotal,
    net: income - expenseTotal,
  };
};

export const getPendingMonths = (
  currentMonthKey: string,
  sales: Sale[],
  expenses: Expense[]
): string[] => {
  const unclosedPastItems = [...sales, ...expenses].filter(item => {
    if (item.isClosed) return false;
    return item.date.substring(0, 7) < currentMonthKey;
  });

  return Array.from(new Set(unclosedPastItems.map(i => i.date.substring(0, 7)))).sort();
};

export const forecastMonthEnd = (
  currentDate: Date,
  monthStats: MonthNetStats
): MonthForecast => {
  const elapsedDays = Math.max(1, currentDate.getDate());
  const totalDays = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const factor = totalDays / elapsedDays;

  const projectedIncome = monthStats.income * factor;
  const projectedExpenses = monthStats.expenses * factor;
  const projectedNet = projectedIncome - projectedExpenses;

  return {
    elapsedDays,
    totalDays,
    projectedIncome,
    projectedExpenses,
    projectedNet,
  };
};
