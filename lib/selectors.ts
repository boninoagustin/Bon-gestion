import { Batch, BatchStatus, Sale, MonthlyBalance, CostItem } from '../types';
import { parseVolumeFromFormat } from './volumeParser';

export const calculateProfitabilityData = (
  batches: Batch[],
  sales: Sale[],
  financialHistory: MonthlyBalance[],
  fixedCosts: CostItem[]
) => {
  const data: Record<string, { 
    name: string, 
    totalCostPerLiter: number, 
    revenue: number, 
    profit: number, 
    litersSold: number 
  }> = {};

  // Pre-calculate monthly stats for REAL overhead distribution
  const monthlyStats: Record<string, { fixedCosts: number, totalVolume: number }> = {};
  
  batches.forEach(b => {
    if (b.status === BatchStatus.PACKAGED || b.status === BatchStatus.COMPLETED) {
      const mKey = (b.packagedDate || b.brewDate || '').slice(0, 7);
      if (!mKey) return;
      const vol = b.volumePackaged || 0;
      if (vol <= 0) return;
      if (!monthlyStats[mKey]) {
        // Find historical costs or use current settings
        const hist = financialHistory.find(h => h.monthKey === mKey);
        const costs = hist?.fixedCostsSnapshot 
          ? hist.fixedCostsSnapshot.reduce((sum, i) => sum + i.amount, 0)
          : fixedCosts.reduce((sum, i) => sum + i.amount, 0);
        monthlyStats[mKey] = { fixedCosts: costs, totalVolume: 0 };
      }
      monthlyStats[mKey].totalVolume += vol;
    }
  });

  batches.forEach(batch => {
    // Skip batches with no packaged volume
    if (!batch.volumePackaged || batch.volumePackaged <= 0) return;
    if (!batch.totalIngredientsCost && batch.totalIngredientsCost !== 0) return;
    
    const vol = batch.volumePackaged;
    
    // Calculate Real Cost Per Liter (Ingredients + Adjusted Overhead)
    const ingCostPerLiter = vol > 0 ? batch.totalIngredientsCost / vol : 0;
    
    let realOverheadPerLiter = 0;
    const mKey = (batch.packagedDate || batch.brewDate || '').slice(0, 7);
    if (mKey && monthlyStats[mKey] && monthlyStats[mKey].totalVolume > 0) {
      realOverheadPerLiter = monthlyStats[mKey].fixedCosts / monthlyStats[mKey].totalVolume;
    } else {
      // Fallback if no data
      if (batch.overheadCost && vol > 0) {
        realOverheadPerLiter = batch.overheadCost / vol;
      }
    }

    const totalRealCostPerLiter = ingCostPerLiter + realOverheadPerLiter;
    
    if (!data[batch.lotCode]) {
      data[batch.lotCode] = { 
        name: batch.recipeName, 
        totalCostPerLiter: totalRealCostPerLiter,
        revenue: 0, 
        profit: 0,
        litersSold: 0
      };
    }
  });

  sales.forEach(sale => {
    if (sale.lotCode && data[sale.lotCode]) {
      const liters = parseVolumeFromFormat(sale.format || '') * (sale.quantity || 1);
      const amount = typeof sale.amount === 'number' && !isNaN(sale.amount) ? sale.amount : 0;
      
      data[sale.lotCode].revenue += amount;
      data[sale.lotCode].litersSold += Math.max(0, liters);
    }
  });

  return Object.entries(data)
    .map(([lotCode, values]) => {
      // Profit is Revenue - (TotalRealCostPerLiter * LitersSold)
      const costOfSoldGoods = values.totalCostPerLiter * values.litersSold;
      const netProfit = values.revenue - costOfSoldGoods;
      const marginPercent = values.revenue > 0 ? (netProfit / values.revenue) * 100 : 0;

      return { 
        lotCode, 
        ...values, 
        profit: netProfit, 
        marginPercent
      };
    })
    .filter(item => item.revenue > 0)
    .sort((a, b) => b.profit - a.profit);
};

export const calculateProfitabilitySummary = (profitabilityData: any[]) => {
  const totalRevenue = profitabilityData.reduce((acc, item) => acc + item.revenue, 0);
  const totalProfit = profitabilityData.reduce((acc, item) => acc + item.profit, 0);
  const weightedAvgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return { totalRevenue, totalProfit, weightedAvgMargin };
};

export const calculateEfficiencyData = (batches: Batch[]) => {
  const calculateEfficiencyForBatch = (batch: Batch) => {
    if (!batch.originalGravity || !batch.volumeFermenter) return 0;
    
    const totalGrainKg = batch.ingredientsUsed
      .filter(ing => ing.type === 'MALT' || ing.type === 'ADJUNCT')
      .reduce((sum, ing) => {
          let qty = ing.amountUsed;
          if (ing.unit === 'g' || ing.unit === 'gr' || ing.unit === 'ml') {
              qty = qty / 1000;
          }
          return sum + qty;
      }, 0);
    if (totalGrainKg === 0) return 0;
    
    let og = batch.originalGravity;
    if (og >= 1000) og = og / 1000;
    
    const actualPoints = batch.volumeFermenter * (og - 1) * 1000;
    const potentialPoints = totalGrainKg * 300;
    if (potentialPoints === 0) return 0;
    return parseFloat(((actualPoints / potentialPoints) * 100).toFixed(1));
  };
  return batches
    .filter(b => b.status !== BatchStatus.PLANNED)
    .map(b => ({ name: b.lotCode, brewDate: b.brewDate, eficiencia: calculateEfficiencyForBatch(b) }))
    .filter(item => item.eficiencia > 0)
    .sort((a, b) => new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime())
    .map(({ name, eficiencia }) => ({ name, eficiencia }))
    .reverse();
};

export const groupSalesHistory = (sales: Sale[]) => {
  const grouped: Record<string, { monthLabel: string, totalRevenue: number, totalItems: number, totalVolume: number, breakdown: Record<string, { type: 'KEG' | 'BOTTLE' | 'TAPROOM', quantity: number, revenue: number, volume: number, format: string, transactions: Sale[] }> }> = {};
  const sortedSales = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  sortedSales.forEach(sale => {
    const dateObj = new Date(sale.date);
    const monthKey = sale.date.substring(0, 7); 
    if (!grouped[monthKey]) {
      const monthName = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      grouped[monthKey] = { monthLabel: monthName.charAt(0).toUpperCase() + monthName.slice(1), totalRevenue: 0, totalItems: 0, totalVolume: 0, breakdown: {} };
    }
    const s = sale;
    const formatKey = s.format || (s.type === 'KEG' ? 'Barril Genérico' : 'Botella Genérica');
    if (!grouped[monthKey].breakdown[formatKey]) {
      grouped[monthKey].breakdown[formatKey] = { type: s.type, quantity: 0, revenue: 0, volume: 0, format: formatKey, transactions: [] };
    }
    const qty = s.quantity || 1;
    const volPerUnit = parseVolumeFromFormat(formatKey);
    const totalVol = volPerUnit * qty;
    grouped[monthKey].totalRevenue += s.amount;
    grouped[monthKey].totalItems += qty;
    grouped[monthKey].totalVolume += totalVol;
    grouped[monthKey].breakdown[formatKey].quantity += qty;
    grouped[monthKey].breakdown[formatKey].revenue += s.amount;
    grouped[monthKey].breakdown[formatKey].volume += totalVol;
    grouped[monthKey].breakdown[formatKey].transactions.push(sale);
  });
  return grouped;
};
