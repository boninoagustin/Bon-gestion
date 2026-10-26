import { Batch, BatchStatus, CostItem, MonthlyBalance, BrewerySettings } from '../../types';

export const generateSmartLotCode = (recipeName: string, batches: Batch[]) => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const initials = recipeName
        ? recipeName.split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3)
        : 'XXX';
    const monthBatches = batches.filter(b => b.brewDate.startsWith(`${now.getFullYear()}-${mm}`));
    const seq = String(monthBatches.length + 1).padStart(2, '0');
    return `BON-${yy}${mm}-${initials}-${seq}`;
};

export const getDaysInStage = (batch: Batch) => {
    const startDate = new Date(batch.brewDate);
    return Math.floor((Date.now() - startDate.getTime()) / 86400000);
};

export const calculateTotalFixedCosts = (costs: CostItem[]) => {
    return costs.reduce((sum, item) => sum + item.amount, 0);
};

export const calculateRealMonthlyVolume = (batches: Batch[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPackagedBatches = batches.filter(b => {
        if (b.status !== BatchStatus.PACKAGED && b.status !== BatchStatus.COMPLETED) return false;
        const packagedOrBrewDate = new Date(b.packagedDate || b.brewDate);
        return packagedOrBrewDate >= thirtyDaysAgo;
    });

    const totalVolume = recentPackagedBatches.reduce((sum, b) => sum + b.volumePackaged, 0);
    return totalVolume;
};

export const getRealMonthAnalysis = (batch: Batch, batches: Batch[], financialHistory: MonthlyBalance[], settings: BrewerySettings) => {
    const rawDate = batch.packagedDate || batch.brewDate;
    const batchDate = rawDate ? new Date(rawDate) : new Date();
    const validDate = !isNaN(batchDate.getTime()) ? batchDate : new Date();
    const monthKey = rawDate && rawDate.length >= 7 ? rawDate.slice(0, 7) : validDate.toISOString().slice(0, 7);

    let fixedCostsTotal = 0;
    let isClosedMonth = false;

    const closedMonthRecord = (financialHistory || []).find(m => m.monthKey === monthKey);

    if (closedMonthRecord && closedMonthRecord.fixedCostsSnapshot) {
        fixedCostsTotal = closedMonthRecord.fixedCostsSnapshot.reduce((sum, item) => sum + item.amount, 0);
        isClosedMonth = true;
    } else {
        fixedCostsTotal = (settings.fixedCosts || []).reduce((sum, item) => sum + item.amount, 0);
    }

    const batchesInMonth = batches.filter(b => {
        const bDate = (b.packagedDate || b.brewDate || '').slice(0, 7);
        return bDate === monthKey && (b.status === BatchStatus.PACKAGED || b.status === BatchStatus.COMPLETED);
    });

    const totalMonthlyVolume = batchesInMonth.reduce((sum, b) => sum + b.volumePackaged, 0);
    const batchCount = batchesInMonth.length;

    const realOverheadRate = totalMonthlyVolume > 0 ? fixedCostsTotal / totalMonthlyVolume : 0;
    const realBatchOverheadCost = realOverheadRate * (batch.volumePackaged || batch.volumeKettle * 0.85);

    const costDiff = batch.overheadCost - realBatchOverheadCost;

    return {
        monthLabel: batchDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
        fixedCostsTotal,
        totalMonthlyVolume,
        batchCount,
        realOverheadRate,
        realBatchOverheadCost,
        costDiff,
        isClosedMonth
    };
};

export const calculateDynamicCost = (batch: Batch) => {
    if (batch.status !== BatchStatus.PACKAGED && batch.status !== BatchStatus.COMPLETED) return '---';

    const totalCost = batch.totalIngredientsCost + batch.overheadCost;
    const divisorVolume = batch.volumePackaged > 0 ? batch.volumePackaged : 1;
    return (totalCost / divisorVolume).toFixed(0);
};

export const calculatePerLiterBreakdown = (batch: Batch) => {
    if (batch.status !== BatchStatus.PACKAGED && batch.status !== BatchStatus.COMPLETED) return { ingredients: '---', fixed: '---' };

    const vol = batch.volumePackaged > 0 ? batch.volumePackaged : 1;
    return {
        ingredients: (batch.totalIngredientsCost / vol).toFixed(0),
        fixed: (batch.overheadCost / vol).toFixed(0)
    };
};

/**
 * Semáforo industrial para estados de lotes de producción:
 * - MASHING: Bronce/Ámbar (#d97706 / #f59e0b)
 * - FERMENTING: Ámbar Dorado Activo (#f59e0b)
 * - CONDITIONING: Azul Enfriamiento / Cold Crash (#0ea5e9 / #38bdf8)
 * - PACKAGED: Verde Lúpulo (#10b981)
 */
export const getStatusColor = (status: BatchStatus) => {
    switch (status) {
        case BatchStatus.PLANNED:
            return 'bg-slate-200 text-slate-700 dark:bg-[#22262b] dark:text-slate-300 border border-slate-300 dark:border-[#2c3138]';
        case BatchStatus.MASHING:
            return 'bg-[#d97706]/15 text-[#d97706] dark:text-[#f59e0b] border border-[#d97706]/35';
        case BatchStatus.FERMENTING:
            return 'bg-[#f59e0b]/15 text-[#d97706] dark:text-[#f59e0b] border border-[#f59e0b]/35';
        case BatchStatus.CONDITIONING:
            return 'bg-[#0ea5e9]/15 text-[#0284c7] dark:text-[#38bdf8] border border-[#0ea5e9]/35';
        case BatchStatus.PACKAGED:
            return 'bg-[#10b981]/15 text-[#059669] dark:text-[#34d399] border border-[#10b981]/35';
        case BatchStatus.COMPLETED:
            return 'bg-slate-700 text-slate-200 dark:bg-[#121417] dark:text-slate-400 border border-[#2c3138]';
        default:
            return 'bg-slate-200 text-slate-700 dark:bg-[#22262b] dark:text-slate-300';
    }
};

export const getEffectiveVolume = (settings: BrewerySettings, batches: Batch[]) => {
    if (settings.targetMonthlyVolume && settings.targetMonthlyVolume > 0) {
        return settings.targetMonthlyVolume;
    }
    return calculateRealMonthlyVolume(batches);
};

export const calculateProjectedOverhead = (kettleVol: number, settings: BrewerySettings, batches: Batch[]) => {
    const totalFixed = calculateTotalFixedCosts(settings.fixedCosts || []);
    const volumeBase = getEffectiveVolume(settings, batches);

    if (volumeBase === 0) return '---';

    const ratePerLiter = totalFixed / volumeBase;
    const estimatedPackagedVol = kettleVol * 0.85;
    return (ratePerLiter * estimatedPackagedVol).toFixed(0);
};

export const getOverheadRate = (settings: BrewerySettings, batches: Batch[]) => {
    const total = calculateTotalFixedCosts(settings.fixedCosts || []);
    const vol = getEffectiveVolume(settings, batches);
    if (vol === 0) return 0;
    return total / vol;
};

export const getNextBatchStatus = (status: BatchStatus): BatchStatus | null => {
    if (status === BatchStatus.PLANNED || status === BatchStatus.MASHING) return BatchStatus.FERMENTING;
    if (status === BatchStatus.FERMENTING) return BatchStatus.CONDITIONING;
    if (status === BatchStatus.CONDITIONING) return BatchStatus.PACKAGED;
    if (status === BatchStatus.PACKAGED) return BatchStatus.COMPLETED;
    return null;
};

export const isValidBatchTransition = (from: BatchStatus, to: BatchStatus): boolean => {
    const next = getNextBatchStatus(from);
    return next === to;
};

export const getTransitionActionLabel = (status: BatchStatus): string => {
    if (status === BatchStatus.PLANNED || status === BatchStatus.MASHING) return 'Pasar a Fermentador';
    if (status === BatchStatus.FERMENTING) return 'Pasar a Maduración';
    if (status === BatchStatus.CONDITIONING) return 'Finalizar Lote';
    if (status === BatchStatus.PACKAGED) return 'Cerrar Lote';
    return 'Actualizar Estado';
};

export const getTransitionChecklist = (batch: Batch): string[] => {
    if (batch.status === BatchStatus.PLANNED || batch.status === BatchStatus.MASHING) {
        const checks: string[] = [];
        if (batch.volumeKettle <= 0) checks.push('Registrar volumen de olla mayor a 0.');
        return checks;
    }

    if (batch.status === BatchStatus.FERMENTING) {
        const checks: string[] = [];
        if (!batch.originalGravity || batch.originalGravity < 1.001) checks.push('Registrar OG válida antes de maduración.');
        if (!batch.fermentationLogs || batch.fermentationLogs.length === 0) checks.push('Agregar al menos una medición de fermentación.');
        return checks;
    }

    if (batch.status === BatchStatus.CONDITIONING) {
        const checks: string[] = [];
        if (!batch.finalGravity || batch.finalGravity < 1.001) checks.push('Registrar FG válida antes de envasar.');
        if (batch.volumeFermenter <= 0) checks.push('Registrar volumen en fermentador mayor a 0.');
        return checks;
    }

    if (batch.status === BatchStatus.PACKAGED) {
        if ((batch.volumeAvailable ?? batch.volumePackaged) > 0) {
            return ['No se puede cerrar: aún queda volumen disponible en lote.'];
        }
    }

    return [];
};
