import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Droplet, TrendingUp, TrendingDown, AlertTriangle, Package, History, Landmark, Award, Percent, PiggyBank, CalendarCheck, Maximize2, Target, ArrowUpRight, FileDown, Banknote, Receipt, Settings, Activity, Coins, Unlock, ShoppingCart } from 'lucide-react';
import { BatchStatus, MonthlyBalance, Batch, Expense } from '../types';
import { useBreweryStore } from '../context/store';
import { ShoppingListWidget } from './ShoppingListWidget';
import { ProfitabilityModal } from './dashboard/ProfitabilityModal';
import { CloseMonthModal } from './dashboard/CloseMonthModal';
import { ExpensesModal } from './dashboard/ExpensesModal';
import { FinancialSettingsModal } from './FinancialSettingsModal';
import { parseVolumeFromFormat, calculateSaleVolume } from '../lib/volumeParser';
import { calculateMonthNet, forecastMonthEnd, getLocalDateString, getLocalMonthKey, getPendingMonths } from '../lib/finance';
import { printMonthlyReport } from '../lib/monthlyReport';
import { printAnnualReport } from '../lib/annualReport';
import { calculateProfitabilityData, calculateProfitabilitySummary, calculateEfficiencyData } from '../lib/selectors';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-zinc-800 p-3 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 text-sm">
                <p className="font-bold font-display text-zinc-900 dark:text-zinc-200 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="font-medium flex justify-between gap-4" style={{ color: entry.color }}>
                        <span>{entry.name}:</span>
                        <span className="font-mono">${entry.value}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export const Dashboard: React.FC = React.memo(() => {
  // Selectores atómicos — cada uno se suscribe solo a su campo
  const batches = useBreweryStore(s => s.batches);
  const kegs = useBreweryStore(s => s.kegs);
  const inventory = useBreweryStore(s => s.inventory);
  const settings = useBreweryStore(s => s.settings);
  const sales = useBreweryStore(s => s.sales);
  const expenses = useBreweryStore(s => s.expenses);
  const financialHistory = useBreweryStore(s => s.financialHistory);
  const shoppingList = useBreweryStore(s => s.shoppingList);
  const annualOverrides = useBreweryStore(s => s.annualOverrides);
  const setAnnualOverride = useBreweryStore(s => s.setAnnualOverride);
  const customers = useBreweryStore(s => s.customers);
  const payments = useBreweryStore(s => s.payments);
  const closeMonth = useBreweryStore(s => s.closeMonth);
  const openMonth = useBreweryStore(s => s.openMonth);
  const addExpense = useBreweryStore(s => s.addExpense);
  
  const [financialTab, setFinancialTab] = useState<'accrual' | 'cashflow'>('cashflow');
  const [isCloseMonthModalOpen, setIsCloseMonthModalOpen] = useState(false);
  const [targetMonthToClose, setTargetMonthToClose] = useState<string | null>(null);
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ops' | 'finance'>('ops');

  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'OTHER' });
  
  // Profitability Modal State
  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);
  // Individual Target Margins State: { [lotCode]: number }
  const [targetMargins, setTargetMargins] = useState<Record<string, number>>({});

  const currentDate = new Date();
  const currentMonthKey = getLocalMonthKey(currentDate);
  const currentMonthLabel = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  const pendingMonths = getPendingMonths(currentMonthKey, sales, expenses);
  const hasPendingMonths = pendingMonths.length > 0;

  const currentMonthStats = useMemo(
    () => calculateMonthNet(currentMonthKey, sales, expenses, settings.fixedCosts),
    [currentMonthKey, sales, expenses, settings.fixedCosts]
  );
  const monthForecast = useMemo(() => forecastMonthEnd(currentDate, currentMonthStats), [currentDate, currentMonthStats]);
  const currentMonthIncome = currentMonthStats.income;
  const currentMonthIncomePaid = currentMonthStats.incomePaid;
  const currentMonthIncomeDebt = currentMonthStats.incomeDebt;
  const currentMonthExpenses = currentMonthStats.expenses;
  const currentNet = currentMonthStats.net;
  const isProfitable = currentNet > 0;

  // Nuevas Métricas Operativas y Volumen
  const currentMonthSalesList = sales.filter(s => s.date.startsWith(currentMonthKey));
  const currentMonthVolume = currentMonthSalesList.reduce((acc, s) => {
      const format = s.format || (s.type === 'KEG' ? 'barril 50' : ''); 
      return acc + calculateSaleVolume(format, s.quantity || 1);
  }, 0);
  const avgPricePerLiter = currentMonthVolume > 0 ? currentMonthIncome / currentMonthVolume : 0;
  
  // Punto de equilibrio
  const fixedCostsTotal = (settings.fixedCosts || []).reduce((sum, item) => sum + item.amount, 0);
  const variableCosts = currentMonthExpenses - fixedCostsTotal;
  const grossProfit = currentMonthIncome - variableCosts;
  const breakEvenDiff = grossProfit - fixedCostsTotal;

  const activeBatches = batches.filter(b => 
      b.status === BatchStatus.MASHING || 
      b.status === BatchStatus.FERMENTING || 
      b.status === BatchStatus.CONDITIONING
  ).length;

  const kegsWithClients = kegs.filter(k => k.status === 'WITH_CLIENT').length;
  const totalInventoryValue = inventory.reduce((sum, item) => sum + (Math.max(0, item.stockAmount || 0) * Math.max(0, item.costPerUnit || 0)), 0);
  const totalReceivables = customers.reduce((sum, c) => sum + c.debt, 0);
  
  const shoppingTotal = shoppingList
    .filter(item => !item.completed)
    .reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

  // Accurate historical profit calculation using SNAPSHOTS
  const totalSales = sales.reduce((acc, s) => acc + s.amount, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalFixedCostsFromHistory = financialHistory.reduce((acc, month) => {
      const fixedTotal = month.fixedCostsSnapshot?.reduce((sum, item) => sum + item.amount, 0) || 0;
      return acc + fixedTotal;
  }, 0);
  const currentFixedCosts = settings.fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  
  const totalLifetimeProfit = totalSales - (totalExpenses + totalFixedCostsFromHistory + currentFixedCosts + (pendingMonths.length * currentFixedCosts));

  const totalHistoricalNet = financialHistory.reduce((acc, month) => acc + month.netResult, 0);

  const annualData = useMemo(() => {
    const months = [];
    const d = new Date();
    const currentYear = d.getFullYear();
    for (let i = 1; i <= 12; i++) {
      const m = `${i}`.padStart(2, '0');
      const monthKey = `${currentYear}-${m}`;
      
      const closedRecord = financialHistory.find(r => r.monthKey === monthKey);
      const isClosed = !!closedRecord;
      
      const overrides = annualOverrides[monthKey] || {};
      
      const mSales = sales.filter(s => s.date.startsWith(monthKey));
      const income = overrides.income !== undefined ? overrides.income : Math.round(mSales.reduce((sum, s) => sum + s.amount, 0));

      const mExpenses = expenses.filter(e => e.date.startsWith(monthKey));
      const insumos = overrides.insumos !== undefined ? overrides.insumos : Math.round(mExpenses.filter(e => e.category === 'INVENTORY').reduce((sum, e) => sum + e.amount, 0));
      const varios = overrides.varios !== undefined ? overrides.varios : Math.round(mExpenses.filter(e => e.category !== 'INVENTORY' && e.category !== 'FIXED').reduce((sum, e) => sum + e.amount, 0));
      
      let fijos = 0;
      if (overrides.fijos !== undefined) {
          fijos = Math.round(overrides.fijos);
      } else if (isClosed && closedRecord.fixedCostsSnapshot) {
          fijos = Math.round(closedRecord.fixedCostsSnapshot.reduce((sum, item) => sum + item.amount, 0));
      } else if (monthKey <= currentMonthKey) {
          fijos = Math.round(settings.fixedCosts.reduce((sum, item) => sum + item.amount, 0));
      } else {
          fijos = 0;
      }
      
      const totalExpenses = insumos + varios + fijos;
      const net = income - totalExpenses;
      
      const dateObj = new Date(currentYear, i - 1, 1);
      const name = dateObj.toLocaleString('es-ES', { month: 'long' });

      months.push({
        monthKey,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        income,
        insumos,
        varios,
        fijos,
        totalExpenses,
        net,
        isClosed,
        hasData: income > 0 || totalExpenses > 0 || mSales.length > 0 || mExpenses.length > 0 || Object.keys(overrides).length > 0,
        record: closedRecord
      });
    }
    return months;
  }, [sales, expenses, settings.fixedCosts, financialHistory, annualOverrides]);

  const last6MonthsData = useMemo(() => {
    const months = [];
    const d = new Date();
    // Generate the last 6 months keys: from 5 months ago to current month
    for (let i = 5; i >= 0; i--) {
      const prev = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const m = `${prev.getMonth() + 1}`.padStart(2, '0');
      months.push(`${prev.getFullYear()}-${m}`);
    }

    const currentMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const fixedCostsSum = Math.round(settings.fixedCosts.reduce((sum, item) => sum + (item.amount || 0), 0));

    return months.map(mKey => {
      const closedRecord = financialHistory.find(r => r.monthKey === mKey);
      const isClosed = !!closedRecord;
      
      const overrides = annualOverrides[mKey] || {};

      let accrualIncome = 0;
      let accrualExpenses = 0;
      let fijos = 0;

      if (isClosed && closedRecord) {
          accrualIncome = closedRecord.income;
          accrualExpenses = closedRecord.expenses;
          fijos = closedRecord.fixedCostsSnapshot ? Math.round(closedRecord.fixedCostsSnapshot.reduce((sum, item) => sum + item.amount, 0)) : 0;
      } else {
          const mSales = sales.filter(s => s.date.startsWith(mKey));
          accrualIncome = overrides.income !== undefined ? overrides.income : Math.round(mSales.reduce((sum, s) => sum + (s.amount || 0), 0));

          const mExpenses = expenses.filter(e => e.date.startsWith(mKey));
          const insumos = overrides.insumos !== undefined ? overrides.insumos : Math.round(mExpenses.filter(e => e.category === 'INVENTORY').reduce((sum, e) => sum + (e.amount || 0), 0));
          const varios = overrides.varios !== undefined ? overrides.varios : Math.round(mExpenses.filter(e => e.category !== 'INVENTORY' && e.category !== 'FIXED').reduce((sum, e) => sum + (e.amount || 0), 0));
          
          if (overrides.fijos !== undefined) {
              fijos = Math.round(overrides.fijos);
          } else if (mKey <= currentMonthKey) {
              fijos = fixedCostsSum;
          } else {
              fijos = 0;
          }

          accrualExpenses = insumos + varios + fijos;
      }

      const accrualNet = accrualIncome - accrualExpenses;

      // 2. Cash Flow / Caja Real calculation
      const mSalesForCash = sales.filter(s => s.date.startsWith(mKey));
      const cashSales = Math.round(mSalesForCash.filter(s => s.isPaid).reduce((sum, s) => sum + (s.amount || 0), 0));
      const cashPayments = Math.round(payments.filter(p => p.date.startsWith(mKey)).reduce((sum, p) => sum + (p.amount || 0), 0));
      const cashIn = cashSales + cashPayments;

      // Cash Out = Expenses in that month + Fixed Costs
      const cashOut = accrualExpenses; 
      const netCashFlow = cashIn - cashOut;

      // Get month label in Spanish
      const [year, monthNum] = mKey.split('-');
      const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const label = dateObj.toLocaleString('es-ES', { month: 'short' }).replace('.', '');

      return {
        monthKey: mKey,
        name: label.charAt(0).toUpperCase() + label.slice(1),
        // Accrual keys
        "Ingresos (Devengado)": accrualIncome,
        "Egresos (Devengado)": accrualExpenses,
        "Neto (Devengado)": accrualNet,
        // Cash Flow keys
        "Ingresos Reales": cashIn,
        "Egresos Reales": cashOut,
        "Flujo Neto": netCashFlow
      };
    });
  }, [sales, expenses, payments, settings.fixedCosts, financialHistory, annualOverrides]);

  const currentMonthCashIn = useMemo(() => {
    const mKey = currentMonthKey;
    const cashSales = sales.filter(s => s.date.startsWith(mKey) && s.isPaid).reduce((sum, s) => sum + s.amount, 0);
    const cashPayments = payments.filter(p => p.date.startsWith(mKey)).reduce((sum, p) => sum + p.amount, 0);
    return cashSales + cashPayments;
  }, [sales, payments, currentMonthKey]);

  const cajaEstimada = useMemo(() => {
    const currentMonthCashOut = currentMonthExpenses;
    const currentMonthNetCash = currentMonthCashIn - currentMonthCashOut;
    return totalHistoricalNet + currentMonthNetCash;
  }, [totalHistoricalNet, currentMonthCashIn, currentMonthExpenses]);

  const proyeccion30d = useMemo(() => {
    return cajaEstimada + totalReceivables;
  }, [cajaEstimada, totalReceivables]);

  // Alerts logic
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const alertPriority = { critical: 3, warning: 2, info: 1 } as const;
  const alerts: { id: string, type: 'warning' | 'critical' | 'info', msg: string; actionLabel: string; onAction: () => void }[] = [];
  const lateKegs = kegs.filter(k => {
      if (k.status !== 'WITH_CLIENT' || !k.dateDispatched) return false;
      const dispatchTime = new Date(k.dateDispatched).getTime();
      if (isNaN(dispatchTime)) return false;
      const days = Math.floor((new Date().getTime() - dispatchTime) / (1000 * 3600 * 24));
      return days > 20;
  });
  if (lateKegs.length > 0) alerts.push({ id: 'kegs', type: 'warning', msg: `${lateKegs.length} Barriles con baja rotación (>20 días)`, actionLabel: 'Ver barriles', onAction: () => scrollToSection('ops-kpis') });

  const oldHops = inventory.filter(i => {
      if (i.type !== 'HOP') return false;
      if (!i.purchaseDate) return false;
      const purchaseTime = new Date(i.purchaseDate).getTime();
      if (isNaN(purchaseTime)) return false;
      const days = Math.floor((Date.now() - purchaseTime) / (1000 * 3600 * 24));
      return days > 60;
  });
  if (oldHops.length > 0) alerts.push({ id: 'hops', type: 'critical', msg: `${oldHops.length} Lotes de Lúpulo perdiendo frescura`, actionLabel: 'Ver stock', onAction: () => scrollToSection('ops-kpis') });

  const lowStock = inventory.filter(i => i.stockAmount < 5);
  if (lowStock.length > 0) alerts.push({ id: 'stock', type: 'warning', msg: `${lowStock.length} Insumos con stock crítico`, actionLabel: 'Ver insumos', onAction: () => scrollToSection('ops-kpis') });
  alerts.sort((a, b) => alertPriority[b.type] - alertPriority[a.type]);

  // --- PROFITABILITY LOGIC ---
  const profitabilityData = useMemo(() => {
    return calculateProfitabilityData(batches, sales, financialHistory, settings.fixedCosts);
  }, [batches, sales, financialHistory, settings.fixedCosts]);

  // Aggregate stats for Profitability Modal
  const profitabilitySummary = useMemo(() => {
      return calculateProfitabilitySummary(profitabilityData);
  }, [profitabilityData]);

  const efficiencyData = useMemo(() => {
    return calculateEfficiencyData(batches);
  }, [batches]);

  const handleOpenCloseMonth = (monthKey: string) => {
      setTargetMonthToClose(monthKey);
      setIsCloseMonthModalOpen(true);
  };

  const confirmCloseMonth = () => {
      if (!targetMonthToClose) return;
      const row = annualData.find(r => r.monthKey === targetMonthToClose);
      const stats = row 
          ? { net: row.net, income: row.income, expenses: row.totalExpenses } 
          : calculateMonthNet(targetMonthToClose, sales, expenses, settings.fixedCosts);
      const isProfit = stats.net > 0;
      
      const fixedCostsSum = Math.round(settings.fixedCosts.reduce((sum, item) => sum + (item.amount || 0), 0));
      const snapshotToSave = (row && row.fijos !== fixedCostsSum) 
          ? [{ id: 'fijos-snapshot', name: 'Costos Fijos', amount: row.fijos }] 
          : settings.fixedCosts;

      const balance: MonthlyBalance = { 
        id: crypto.randomUUID(), 
        monthKey: targetMonthToClose, 
        income: stats.income, 
        expenses: stats.expenses, 
        netResult: stats.net, 
        isClosed: true, 
        closedDate: new Date().toISOString(), 
        fixedCostsSnapshot: snapshotToSave 
      };
      closeMonth(balance);
      setIsCloseMonthModalOpen(false);
      setTargetMonthToClose(null);
  };

  const handleAddExpense = () => {
      if (!expenseForm.description || expenseForm.amount <= 0) return;
      addExpense({ id: crypto.randomUUID(), date: getLocalDateString(new Date()), description: expenseForm.description, amount: expenseForm.amount, category: expenseForm.category as Expense['category'] });
      setIsExpenseModalOpen(false);
      setExpenseForm({ description: '', amount: 0, category: 'OTHER' });
  };

  const getTargetMonthLabel = () => {
      if (!targetMonthToClose) return '';
      const [y, m] = targetMonthToClose.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, 1);
      return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  };
  
  const targetStats = useMemo(() => {
      if (!targetMonthToClose) return { net: 0, income: 0, expenses: 0 };
      const row = annualData.find(r => r.monthKey === targetMonthToClose);
      return row 
          ? { net: row.net, income: row.income, expenses: row.totalExpenses }
          : calculateMonthNet(targetMonthToClose, sales, expenses, settings.fixedCosts);
  }, [targetMonthToClose, annualData, sales, expenses, settings.fixedCosts]);
  
  const targetIsProfitable = targetStats.net > 0;

  const updateBatchTargetMargin = (lotCode: string, val: number) => {
      const clamped = Math.min(95, Math.max(0, Number.isFinite(val) ? val : 0));
      setTargetMargins(prev => ({ ...prev, [lotCode]: clamped }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* PROFITABILITY MODAL */}
      <ProfitabilityModal
          isOpen={isProfitModalOpen}
          onClose={() => setIsProfitModalOpen(false)}
          profitabilitySummary={profitabilitySummary}
          profitabilityData={profitabilityData}
          targetMargins={targetMargins}
          updateBatchTargetMargin={updateBatchTargetMargin}
      />

      {/* EXISTING MODALS (Close Month, Expenses) */}
      <CloseMonthModal
          isOpen={isCloseMonthModalOpen}
          onClose={() => setIsCloseMonthModalOpen(false)}
          targetMonthToClose={targetMonthToClose || ''}
          getTargetMonthLabel={getTargetMonthLabel}
          targetStats={targetStats}
          targetIsProfitable={targetIsProfitable}
          confirmCloseMonth={confirmCloseMonth}
      />

      <ExpensesModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          expenseForm={expenseForm}
          setExpenseForm={setExpenseForm}
          handleAddExpense={handleAddExpense}
      />

      {isSettingsModalOpen && (
          <FinancialSettingsModal
              onClose={() => setIsSettingsModalOpen(false)}
          />
      )}

      {/* Header Panel Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">Panel de Control</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Monitorea y gestiona las operaciones y finanzas de la cervecería</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsSettingsModalOpen(true)} className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-copper/10 hover:text-copper dark:hover:bg-copper/20 dark:hover:text-copper px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border border-zinc-200 dark:border-zinc-600 transition">
                <Settings size={16} /> Gastos Fijos
            </button>
            <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-50 dark:bg-red-900/30 text-rose-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border border-red-200 dark:border-red-800/50">
                <TrendingDown size={16}/> Registrar Gasto
            </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6 mt-4">
        <button
          onClick={() => setActiveTab('ops')}
          className={`flex items-center gap-2 pb-3 text-sm font-bold transition-colors relative ${
            activeTab === 'ops'
              ? 'text-copper'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Activity size={16} />
          Operaciones
          {activeTab === 'ops' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-copper rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-2 pb-3 text-sm font-bold transition-colors relative ${
            activeTab === 'finance'
              ? 'text-copper'
              : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Coins size={16} />
          Finanzas y Caja
          {activeTab === 'finance' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-copper rounded-full" />
          )}
        </button>
      </div>

      {hasPendingMonths && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <div className="bg-amber-100 p-2 rounded-full text-amber-700"><AlertTriangle size={20} /></div>
                      <div>
                          <h4 className="font-bold text-amber-900">Cierres Pendientes</h4>
                          <p className="text-sm text-amber-800">Tienes movimientos de <strong>{pendingMonths.length} mes(es) anterior(es)</strong> sin cerrar.</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      {pendingMonths.map(m => (
                          <button key={m} onClick={() => handleOpenCloseMonth(m)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">
                              Cerrar {m}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* CONDITIONAL TABS RENDER */}
      {activeTab === 'ops' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Operaciones KPIs */}
          <div id="ops-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between card-hover">
                  <div>
                      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Lotes Proc.</p>
                      <h3 className="text-2xl font-black font-display tracking-tight text-zinc-950 dark:text-white mt-1">{activeBatches}</h3>
                  </div>
                  <div className="p-3 bg-copper/10 text-copper rounded-full hidden sm:block"><Droplet size={22} /></div>
              </div>
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between card-hover">
                  <div>
                      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Barriles Calle</p>
                      <h3 className="text-2xl font-black font-display tracking-tight text-zinc-950 dark:text-white mt-1">{kegsWithClients}</h3>
                  </div>
                  <div className="p-3 bg-copper/10 text-copper rounded-full hidden sm:block"><Package size={22} /></div>
              </div>
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between card-hover">
                  <div>
                      <p className="text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Stock Insumos</p>
                      <h3 className="text-xl sm:text-2xl font-black font-display tracking-tight text-zinc-950 dark:text-white mt-1 font-mono">${totalInventoryValue.toFixed(0)}</h3>
                  </div>
                  <div className="p-3 bg-copper/10 text-copper rounded-full hidden sm:block"><ArrowUpRight size={22} /></div>
              </div>
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between card-hover">
                  <div>
                      <p className="text-[10px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">A Comprar</p>
                      <h3 className="text-xl sm:text-2xl font-black font-display tracking-tight text-rose-500 mt-1 font-mono">${shoppingTotal.toFixed(0)}</h3>
                  </div>
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full hidden sm:block"><ShoppingCart size={22} /></div>
              </div>
          </div>

          {/* Gráficos de Eficiencia y Lista de Compras */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Evolución de Eficiencia */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96 flex flex-col">
                  <h3 className="text-lg font-bold font-display mb-4 text-zinc-900 dark:text-white flex items-center gap-2 shrink-0">
                      <Percent size={20} className="text-copper" /> Evolución de Eficiencia
                  </h3>
                  <div className="flex-1 w-full min-h-0">
                      {efficiencyData.length > 1 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={efficiencyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                  <defs>
                                      <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#b87333" stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor="#b87333" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" className="dark:stroke-zinc-800" />
                                  <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                  <YAxis domain={[60, 90]} tick={{fontSize: 10}} tickFormatter={(val) => `${val}%`} />
                                  <Tooltip cursor={{stroke: 'rgba(148, 163, 184, 0.2)', strokeWidth: 2}} content={<CustomTooltip />} />
                                  <Area type="monotone" dataKey="eficiencia" stroke="#b87333" fill="url(#colorEff)" strokeWidth={2} />
                              </AreaChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 bg-zinc-50/50 dark:bg-zinc-800/30 backdrop-blur-sm rounded-2xl">
                              <Percent size={48} className="mb-2 opacity-30 text-zinc-400" />
                              <p className="text-sm font-medium">Necesitas al menos 2 lotes para ver la evolución.</p>
                          </div>
                      )}
                  </div>
              </div>

              {/* Widget de lista de compras */}
              <div className="h-96">
                  <ShoppingListWidget />
              </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Sección de Finanzas y Caja */}
          <div className="grid grid-cols-1 gap-6">
              {/* Tarjeta Mes Actual */}
              <div className="bg-slate-dark rounded-2xl p-6 text-white shadow-2xl shadow-zinc-950/10 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center">
                      <img src="icon.png" alt="" className="w-96 h-96 object-contain" />
                  </div>
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10 w-full">
                      <div className="flex-1">
                          <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                              <CalendarCheck size={16} /> Mes Actual ({currentMonthLabel})
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                              <div>
                                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                                      <Banknote size={12} /> Caja Real
                                  </p>
                                  <p className="text-xl font-bold font-display text-green-400 font-mono">+${currentMonthIncomePaid.toFixed(0)}</p>
                              </div>
                              <div>
                                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                                      <Receipt size={12} /> Ingreso Devengado
                                  </p>
                                  <p className="text-xl font-bold font-display text-green-400 font-mono">+${currentMonthIncome.toFixed(0)}</p>
                                  <div className="mt-1">
                                      <span className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded" title="Dinero en la Calle (Fiado)">
                                          CC: ${currentMonthIncomeDebt.toFixed(0)}
                                      </span>
                                  </div>
                              </div>
                              <div>
                                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                                      <TrendingDown size={12} /> Egresos
                                  </p>
                                  <p className="text-xl font-bold font-display text-red-400 font-mono">-${currentMonthExpenses.toFixed(0)}</p>
                              </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mt-6 pt-4 border-t border-zinc-700/50">
                              <div className="p-4 bg-black/20 rounded-xl border border-zinc-700 inline-block min-w-[200px]">
                                  <p className="text-xs text-zinc-300 uppercase font-bold mb-1">Ganancia Neta (Mes)</p>
                                  <p className={`text-3xl font-bold font-mono ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {currentNet > 0 ? '+' : ''}${currentNet.toFixed(0)}
                                  </p>
                                  <div className="mt-2 text-xs text-zinc-300">
                                      Proyección: <span className={`font-mono font-bold ${monthForecast.projectedNet >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                          ${monthForecast.projectedNet.toFixed(0)}
                                      </span>
                                      <span className="text-zinc-500 text-[10px] block mt-0.5"> ({monthForecast.elapsedDays}/{monthForecast.totalDays} días)</span>
                                  </div>
                              </div>
                              
                              <div className="flex-1 w-full">
                                  <p className="text-[10px] text-zinc-400 uppercase font-bold mb-1">Punto de Equilibrio</p>
                                  <div className={`border rounded-xl p-2 ${breakEvenDiff >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                          <div className="flex items-center gap-1.5">
                                              <div className={`w-1.5 h-1.5 rounded-full ${breakEvenDiff >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                              <span className={`text-[11px] font-medium ${breakEvenDiff >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                  {breakEvenDiff >= 0 ? `Costos cubiertos (+$${breakEvenDiff.toFixed(0)})` : `Faltan $${Math.abs(breakEvenDiff).toFixed(0)}`}
                                              </span>
                                          </div>
                                          <span className={`text-[10px] ${breakEvenDiff >= 0 ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
                                              {Math.min(100, Math.round((grossProfit / (fixedCostsTotal || 1)) * 100))}%
                                          </span>
                                      </div>
                                      <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                                          <div className={`${breakEvenDiff >= 0 ? 'bg-emerald-500' : 'bg-amber-500'} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.min(100, Math.max(0, (grossProfit / (fixedCostsTotal || 1)) * 100))}%` }}></div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Finanzas KPIs */}
          <div id="finance-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-rose-50/50 dark:bg-rose-950/10 p-4 rounded-xl shadow-sm border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between card-hover">
                  <div>
                      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Por Cobrar</p>
                      <h3 className="text-xl font-bold font-display text-rose-600 dark:text-rose-400 font-mono mt-1">${totalReceivables.toFixed(0)}</h3>
                  </div>
                  <div className="self-end mt-2 p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl"><Target size={20} /></div>
              </div>
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between card-hover">
                   <div>
                       <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Ganancia Hist.</p>
                       <h3 className={`text-xl font-bold font-display font-mono mt-1 ${totalLifetimeProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                           ${totalLifetimeProfit.toFixed(0)}
                       </h3>
                   </div>
                   <div className="self-end mt-2 p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><TrendingUp size={20} /></div>
              </div>
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between card-hover">
                   <div>
                       <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Vol. Vendido (Mes)</p>
                       <h3 className="text-xl font-bold font-display text-zinc-900 dark:text-zinc-100 mt-1">{currentMonthVolume.toFixed(1)} <span className="text-sm font-sans font-normal text-zinc-500">L</span></h3>
                   </div>
                   <div className="self-end mt-2 p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl"><Droplet size={20} /></div>
              </div>
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800/50 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between card-hover">
                   <div>
                       <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">Precio Prom. (Mes)</p>
                       <h3 className="text-xl font-bold font-display text-zinc-900 dark:text-zinc-100 mt-1 font-mono">${avgPricePerLiter.toFixed(0)} <span className="text-sm font-sans font-normal text-zinc-500">/L</span></h3>
                   </div>
                   <div className="self-end mt-2 p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl"><Banknote size={20} /></div>
              </div>
          </div>

          {/* Resumen Financiero Anual */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
              <div className="p-4 border-b-2 border-copper/50 bg-zinc-50 dark:bg-zinc-800/80 flex justify-between items-center shrink-0">
                  <h4 className="font-bold font-display text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <CalendarCheck size={16} className="text-copper"/> Resumen Financiero Anual ({new Date().getFullYear()})
                  </h4>
                  <button onClick={() => printAnnualReport(annualData, new Date().getFullYear())} className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-copper hover:border-copper px-3 py-1.5 rounded-xl flex items-center gap-2 transition shadow-sm font-semibold">
                      <FileDown size={14} /> Exportar
                  </button>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[10px]">
                          <tr>
                              <th className="px-4 py-3 text-center">Mes</th>
                              <th className="px-4 py-3 text-right">Ingresos</th>
                              <th className="px-4 py-3 text-right">Fijos</th>
                              <th className="px-4 py-3 text-right">Insumos</th>
                              <th className="px-4 py-3 text-right">Varios</th>
                              <th className="px-4 py-3 text-right">Total Egresos</th>
                              <th className="px-4 py-3 text-right">Balance Neto</th>
                              <th className="px-4 py-3 text-center">Estado</th>
                              <th className="px-4 py-3 text-center">Acción</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {annualData.map(row => (
                              <tr key={row.monthKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                  <td className="px-4 py-3 font-medium font-display text-zinc-900 dark:text-zinc-200 text-center">{row.name}</td>
                                  <td className="px-4 py-3 text-right">
                                      <div className={`flex items-center justify-end font-mono text-emerald-600 ${row.isClosed ? 'opacity-70' : ''}`}>
                                          <span>$</span>
                                          <input 
                                              type="number" 
                                              value={Math.round(row.income)} 
                                              placeholder="0"
                                              disabled={row.isClosed}
                                              onChange={(e) => setAnnualOverride(row.monthKey, 'income', e.target.value === '' ? undefined : Math.round(Number(e.target.value)))}
                                              className={`w-24 py-1.5 px-2 rounded-md text-right outline-none transition-all ${row.isClosed ? 'bg-transparent border-transparent cursor-not-allowed' : 'bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:ring-2 focus:ring-copper/50 focus:border-copper'}`}
                                          />
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <div className={`flex items-center justify-end font-mono text-zinc-600 dark:text-zinc-400 ${row.isClosed ? 'opacity-70' : ''}`}>
                                          <span>-$</span>
                                          <input 
                                              type="number" 
                                              value={Math.round(row.fijos)} 
                                              placeholder="0"
                                              disabled={row.isClosed}
                                              onChange={(e) => setAnnualOverride(row.monthKey, 'fijos', e.target.value === '' ? undefined : Math.round(Number(e.target.value)))}
                                              className={`w-24 py-1.5 px-2 rounded-md text-right outline-none transition-all ${row.isClosed ? 'bg-transparent border-transparent cursor-not-allowed' : 'bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:ring-2 focus:ring-copper/50 focus:border-copper'}`}
                                          />
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <div className={`flex items-center justify-end font-mono text-zinc-600 dark:text-zinc-400 ${row.isClosed ? 'opacity-70' : ''}`}>
                                          <span>-$</span>
                                          <input 
                                              type="number" 
                                              value={Math.round(row.insumos)} 
                                              placeholder="0"
                                              disabled={row.isClosed}
                                              onChange={(e) => setAnnualOverride(row.monthKey, 'insumos', e.target.value === '' ? undefined : Math.round(Number(e.target.value)))}
                                              className={`w-24 py-1.5 px-2 rounded-md text-right outline-none transition-all ${row.isClosed ? 'bg-transparent border-transparent cursor-not-allowed' : 'bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:ring-2 focus:ring-copper/50 focus:border-copper'}`}
                                          />
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <div className={`flex items-center justify-end font-mono text-zinc-600 dark:text-zinc-400 ${row.isClosed ? 'opacity-70' : ''}`}>
                                          <span>-$</span>
                                          <input 
                                              type="number" 
                                              value={Math.round(row.varios)} 
                                              placeholder="0"
                                              disabled={row.isClosed}
                                              onChange={(e) => setAnnualOverride(row.monthKey, 'varios', e.target.value === '' ? undefined : Math.round(Number(e.target.value)))}
                                              className={`w-24 py-1.5 px-2 rounded-md text-right outline-none transition-all ${row.isClosed ? 'bg-transparent border-transparent cursor-not-allowed' : 'bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:ring-2 focus:ring-copper/50 focus:border-copper'}`}
                                          />
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-rose-500 font-bold">-${row.totalExpenses.toFixed(0)}</td>
                                  <td className={`px-4 py-3 text-right font-mono font-bold ${row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {row.net > 0 ? '+' : ''}${row.net.toFixed(0)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      {row.isClosed ? (
                                          <span className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded text-[10px] font-bold uppercase border border-zinc-200 dark:border-zinc-700">Cerrado</span>
                                      ) : row.hasData || row.monthKey <= currentMonthKey ? (
                                          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-1 rounded text-[10px] font-bold uppercase border border-amber-200 dark:border-amber-800/50">Abierto</span>
                                      ) : (
                                          <span className="text-zinc-300 dark:text-zinc-600">-</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                      {row.isClosed ? (
                                          <div className="flex justify-center gap-2">
                                              <button onClick={() => row.record && printMonthlyReport(row.record, sales, expenses, batches)} className="p-1.5 text-zinc-400 hover:text-copper hover:bg-copper/10 rounded-full transition" title="Exportar Reporte">
                                                  <FileDown size={16} className="mx-auto" />
                                              </button>
                                              <button onClick={() => { openMonth(row.monthKey); }} className="text-[11px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40 dark:hover:text-amber-400 px-3 py-1.5 rounded-xl flex items-center gap-1 transition shadow-sm font-bold border border-zinc-200 dark:border-zinc-700 hover:border-amber-300" title="Reabrir Mes (Permite edición)">
                                                  <Unlock size={12} /> Reabrir
                                              </button>
                                          </div>
                                      ) : (row.hasData || row.monthKey <= currentMonthKey) ? (
                                          <button onClick={() => handleOpenCloseMonth(row.monthKey)} className="text-[11px] bg-copper text-white px-3 py-1.5 rounded-xl hover:bg-copper-dark transition font-bold shadow-sm">
                                              Cerrar
                                          </button>
                                      ) : (
                                          <span className="text-zinc-300 dark:text-zinc-600">-</span>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Gráficos y Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Flujo de caja y P&G */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96 flex flex-col">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 shrink-0">
                      <h3 className="text-lg font-bold font-display text-zinc-900 dark:text-white flex items-center gap-2">
                          <TrendingUp size={20} className="text-copper" /> 
                          {financialTab === 'cashflow' ? 'Flujo de Caja Real (Últ. 6 meses)' : 'Pérdidas y Ganancias (Últ. 6 meses)'}
                      </h3>
                      <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold self-end sm:self-auto">
                          <button 
                              onClick={() => setFinancialTab('cashflow')}
                              className={`px-3 py-1.5 rounded-md transition ${financialTab === 'cashflow' ? 'bg-white dark:bg-zinc-700 text-copper shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                          >
                              Flujo de Caja
                          </button>
                          <button 
                              onClick={() => setFinancialTab('accrual')}
                              className={`px-3 py-1.5 rounded-md transition ${financialTab === 'accrual' ? 'bg-white dark:bg-zinc-700 text-copper shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                          >
                              P&G (Devengado)
                          </button>
                      </div>
                  </div>

                  {financialTab === 'cashflow' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 shrink-0 animate-fade-in">
                          <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 flex items-center gap-3">
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                  <PiggyBank size={18} />
                              </div>
                              <div>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">Caja Estimada</p>
                                  <p className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-200">${cajaEstimada.toFixed(0)}</p>
                              </div>
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 flex items-center gap-3">
                              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                                  <Receipt size={18} />
                              </div>
                              <div>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">Por Cobrar (30d)</p>
                                  <p className="font-mono text-sm font-bold text-amber-600 dark:text-amber-500">+${totalReceivables.toFixed(0)}</p>
                              </div>
                          </div>
                          <div className="bg-copper/5 dark:bg-copper/10 p-3 rounded-xl border border-copper/15 flex items-center gap-3 relative overflow-hidden">
                              <div className="absolute right-0 bottom-0 opacity-5 text-copper pointer-events-none translate-x-2 translate-y-2">
                                  <TrendingUp size={48} />
                              </div>
                              <div className="p-2 bg-copper/10 text-copper rounded-xl">
                                  <TrendingUp size={18} />
                              </div>
                              <div>
                                  <p className="text-[10px] text-copper uppercase font-black">Proyección Caja</p>
                                  <p className="font-mono text-sm font-bold text-copper">${proyeccion30d.toFixed(0)}</p>
                              </div>
                          </div>
                      </div>
                  )}

                  <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                          {financialTab === 'cashflow' ? (
                              <AreaChart data={last6MonthsData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                  <defs>
                                      <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.2}/>
                                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                                      </linearGradient>
                                      <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#f87171" stopOpacity={0.2}/>
                                          <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                                      </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" className="dark:stroke-zinc-800" />
                                  <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                  <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `$${val}`} />
                                  <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                                  <Area type="monotone" dataKey="Ingresos Reales" stroke="#4ade80" fill="url(#colorCashIn)" strokeWidth={2.5} />
                                  <Area type="monotone" dataKey="Egresos Reales" stroke="#f87171" fill="url(#colorCashOut)" strokeWidth={2} strokeDasharray="4 4" />
                              </AreaChart>
                          ) : (
                              <BarChart data={last6MonthsData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" className="dark:stroke-zinc-800" />
                                  <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                  <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `$${val}`} />
                                  <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                                  <Bar dataKey="Ingresos (Devengado)" fill="#4ade80" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="Egresos (Devengado)" fill="#f87171" radius={[4, 4, 0, 0]} />
                              </BarChart>
                          )}
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* Ranking Rentabilidad */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-96 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold font-display text-zinc-900 dark:text-white flex items-center gap-2 shrink-0"><Award size={20} className="text-copper" /> Ranking de Rentabilidad</h3>
                      <button 
                          onClick={() => setIsProfitModalOpen(true)}
                          className="text-copper hover:bg-copper/10 p-1.5 rounded transition"
                          title="Expandir Análisis Detallado"
                      >
                          <Maximize2 size={18} />
                      </button>
                  </div>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                      {profitabilityData.length > 0 ? profitabilityData.slice(0, 5).map((item, index) => (
                          <div key={item.lotCode} className="bg-zinc-50/70 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                      <span className="font-bold text-zinc-400 text-sm w-5 text-center">{index + 1}</span>
                                      <div>
                                          <p className="font-bold text-zinc-900 dark:text-zinc-200">{item.name}</p>
                                          <p className="text-xs text-zinc-400 font-mono">{item.lotCode}</p>
                                      </div>
                                  </div>
                                  <div className={`text-right ${item.profit > 0 ? 'text-emerald-600 dark:text-green-400' : 'text-rose-600 dark:text-red-400'}`}>
                                      <p className="font-bold font-mono text-lg">{item.profit > 0 ? '+' : ''}${item.profit.toFixed(0)}</p>
                                      <p className="text-xs text-zinc-400">{item.marginPercent.toFixed(0)}% Margen</p>
                                  </div>
                              </div>
                          </div>
                      )) : (
                          <div className="text-center py-10 text-zinc-400"><p>No hay datos de ventas vinculadas a lotes.</p></div>
                      )}
                  </div>
              </div>
          </div>
        </div>
      )}

    </div>
  );
});