import { Batch, Expense, MonthlyBalance, Sale } from '../types';

const pintKeywords = ['500', 'pinta', '0.5', 'media'];
const literKeywords = ['1000', '1l', '1 l', 'litro', '1.0', 'jarra', 'growler'];

export const printMonthlyReport = (
  balance: MonthlyBalance,
  sales: Sale[],
  expenses: Expense[],
  batches: Batch[]
) => {
  const monthKey = balance.monthKey;
  const monthSales = sales.filter(s => s.date.startsWith(monthKey));
  const monthExpenses = expenses.filter(e => e.date.startsWith(monthKey));
  const monthBatches = batches.filter(b => b.brewDate.startsWith(monthKey));

  const volProduced = monthBatches.reduce((acc, b) => acc + b.volumeKettle, 0);
  const volPackaged = monthBatches.reduce((acc, b) => acc + b.volumePackaged, 0);
  const kegSalesCount = monthSales.filter(s => s.type === 'KEG').reduce((acc, s) => acc + (s.quantity || 1), 0);
  const pintSalesCount = monthSales
    .filter(s => (s.type === 'BOTTLE' || s.type === 'TAPROOM') && pintKeywords.some(k => (s.format || '').toLowerCase().includes(k)))
    .reduce((acc, s) => acc + (s.quantity || 1), 0);
  const literSalesCount = monthSales
    .filter(s => (s.type === 'BOTTLE' || s.type === 'TAPROOM') && literKeywords.some(k => (s.format || '').toLowerCase().includes(k)))
    .reduce((acc, s) => acc + (s.quantity || 1), 0);
  const totalBottleAndTaproomSales = monthSales.filter(s => s.type === 'BOTTLE' || s.type === 'TAPROOM').reduce((acc, s) => acc + (s.quantity || 1), 0);
  const otherSalesCount = Math.max(0, totalBottleAndTaproomSales - (pintSalesCount + literSalesCount));

  const categoryExpenses: Record<string, number> = {};
  monthExpenses.forEach(e => {
    categoryExpenses[e.category] = (categoryExpenses[e.category] || 0) + e.amount;
  });
  const fixedTotal = balance.fixedCostsSnapshot?.reduce((sum, i) => sum + i.amount, 0) || 0;
  if (fixedTotal > 0) categoryExpenses.FIXED_OVERHEAD = fixedTotal;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Mensual - ${monthKey}</title>
  <style>
    @page { size: A4; margin: 1cm; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #1a1a1a; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b87333; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
    .logo span { color: #b87333; font-family: serif; font-style: italic; font-weight: normal; letter-spacing: 0; font-size: 18px; }
    .report-title { text-align: right; }
    .report-title h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
    .report-title p { margin: 5px 0 0; color: #666; font-size: 14px; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .card { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
    .card-label { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #888; display: block; margin-bottom: 5px; }
    .card-value { font-size: 18px; font-weight: bold; font-family: monospace; }
    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; border-bottom: 1px solid #ccc; padding: 8px 4px; font-weight: bold; color: #444; }
    td { border-bottom: 1px solid #eee; padding: 8px 4px; color: #333; }
    .text-right { text-align: right; }
    .footer { margin-top: 50px; border-top: 1px dashed #ccc; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
    .signature-box { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 5px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">BON <span>artesanal</span></div>
    <div class="report-title">
      <h1>Reporte Operativo Mensual</h1>
      <p>Periodo: ${monthKey} • Generado: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
  <div class="section">
    <div class="section-title">1. Resumen Financiero</div>
    <div class="grid-3">
      <div class="card"><span class="card-label">Ingresos Totales</span><span class="card-value">$${balance.income.toFixed(0)}</span></div>
      <div class="card"><span class="card-label">Gastos Operativos</span><span class="card-value">$${balance.expenses.toFixed(0)}</span></div>
      <div class="card"><span class="card-label">Utilidad Neta</span><span class="card-value ${balance.netResult >= 0 ? 'text-green' : 'text-red'}">${balance.netResult >= 0 ? '+' : ''}$${balance.netResult.toFixed(0)}</span></div>
    </div>
    <div style="margin-top:15px;">
      <table>
        <thead><tr><th>Categoría de Gasto</th><th class="text-right">Monto</th></tr></thead>
        <tbody>
          ${Object.entries(categoryExpenses).map(([cat, amount]) => `
            <tr>
              <td>${cat === 'INVENTORY' ? 'Compra Insumos' : cat === 'FIXED_OVERHEAD' ? 'Costos Fijos (Alquiler/Servicios)' : cat}</td>
              <td class="text-right">$${amount.toFixed(0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div class="section">
    <div class="section-title">2. Resumen de Producción (Trazabilidad)</div>
    <div class="grid-3">
      <div class="card"><span class="card-label">Lotes Cocinados</span><span class="card-value">${monthBatches.length}</span></div>
      <div class="card"><span class="card-label">Litros Producidos</span><span class="card-value">${volProduced} L</span></div>
      <div class="card"><span class="card-label">Litros Envasados</span><span class="card-value">${volPackaged} L</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">3. Métricas Comerciales</div>
    <div class="grid-3">
      <div class="card"><span class="card-label">Transacciones</span><span class="card-value">${monthSales.length}</span></div>
      <div class="card"><span class="card-label">Barriles Vendidos</span><span class="card-value">${kegSalesCount}</span></div>
      <div class="card"><span class="card-label">Vasos/Botellas 500ml</span><span class="card-value">${pintSalesCount}</span></div>
      <div class="card"><span class="card-label">Vasos/Botellas 1 Litro</span><span class="card-value">${literSalesCount}</span></div>
      <div class="card"><span class="card-label">Otros Formatos</span><span class="card-value">${otherSalesCount}</span></div>
    </div>
  </div>
  <div class="footer">
    <div>Documento Interno - BON Artesanal</div>
    <div class="signature-box">Firma Responsable</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    }
  </script>
</body>
</html>`;

  const existingIframe = document.getElementById('bon-print-frame');
  if (existingIframe) existingIframe.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'bon-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Failed to access iframe document for report generation");
    return;
  }
  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {
      // no-op
    }
  }, 5000);
};
