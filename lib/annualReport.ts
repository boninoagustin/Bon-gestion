export const printAnnualReport = (annualData: any[], year: number) => {
  const totalIncome = annualData.reduce((acc, row) => acc + row.income, 0);
  const totalFijos = annualData.reduce((acc, row) => acc + row.fijos, 0);
  const totalInsumos = annualData.reduce((acc, row) => acc + row.insumos, 0);
  const totalVarios = annualData.reduce((acc, row) => acc + row.varios, 0);
  const totalExpenses = annualData.reduce((acc, row) => acc + row.totalExpenses, 0);
  const totalNet = annualData.reduce((acc, row) => acc + row.net, 0);

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Anual - ${year}</title>
  <style>
    @page { size: A4 landscape; margin: 1cm; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #1a1a1a; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b87333; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
    .logo span { color: #b87333; font-family: serif; font-style: italic; font-weight: normal; letter-spacing: 0; font-size: 18px; }
    .report-title { text-align: right; }
    .report-title h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
    .report-title p { margin: 5px 0 0; color: #666; font-size: 14px; }
    
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .card { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; text-align: center; }
    .card-label { font-size: 10px; text-transform: uppercase; font-weight: bold; color: #888; display: block; margin-bottom: 5px; }
    .card-value { font-size: 18px; font-weight: bold; font-family: monospace; }
    .text-green { color: #16a34a; }
    .text-red { color: #dc2626; }
    
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px; }
    th { text-align: right; border-bottom: 2px solid #ccc; padding: 10px 4px; font-weight: bold; color: #444; text-transform: uppercase; }
    th:first-child { text-align: left; }
    td { border-bottom: 1px solid #eee; padding: 10px 4px; color: #333; font-family: monospace; text-align: right; }
    td:first-child { text-align: left; font-family: system-ui, -apple-system, sans-serif; font-weight: bold; font-size: 12px; }
    
    .totals-row td { border-top: 2px solid #ccc; font-weight: bold; font-size: 12px; color: #000; background: #f9f9f9; }
    
    .footer { margin-top: 50px; border-top: 1px dashed #ccc; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
    .signature-box { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 5px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">BON <span>artesanal</span></div>
    <div class="report-title">
      <h1>Reporte Financiero Anual</h1>
      <p>Año: ${year} • Generado: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <div class="grid-4">
    <div class="card"><span class="card-label">Ingresos Totales</span><span class="card-value text-green">$${totalIncome.toFixed(0)}</span></div>
    <div class="card"><span class="card-label">Insumos y Varios</span><span class="card-value">$${(totalInsumos + totalVarios).toFixed(0)}</span></div>
    <div class="card"><span class="card-label">Costos Fijos Totales</span><span class="card-value">$${totalFijos.toFixed(0)}</span></div>
    <div class="card"><span class="card-label">Balance Neto Total</span><span class="card-value ${totalNet >= 0 ? 'text-green' : 'text-red'}">${totalNet > 0 ? '+' : ''}$${totalNet.toFixed(0)}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Mes</th>
        <th>Ingresos</th>
        <th>Costos Fijos</th>
        <th>Costo Insumos</th>
        <th>Gastos Varios</th>
        <th>Egresos Totales</th>
        <th>Balance Neto</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${annualData.map(row => `
        <tr>
          <td>${row.name}</td>
          <td class="text-green">$${row.income.toFixed(0)}</td>
          <td>-$${row.fijos.toFixed(0)}</td>
          <td>-$${row.insumos.toFixed(0)}</td>
          <td>-$${row.varios.toFixed(0)}</td>
          <td class="text-red">-$${row.totalExpenses.toFixed(0)}</td>
          <td class="${row.net >= 0 ? 'text-green' : 'text-red'}">${row.net > 0 ? '+' : ''}$${row.net.toFixed(0)}</td>
          <td style="font-family: system-ui; text-transform: uppercase; font-size: 9px; color: ${row.isClosed ? '#16a34a' : '#888'}">${row.isClosed ? 'Cerrado' : 'Abierto'}</td>
        </tr>
      `).join('')}
      <tr class="totals-row">
        <td>TOTAL ANUAL</td>
        <td class="text-green">$${totalIncome.toFixed(0)}</td>
        <td>-$${totalFijos.toFixed(0)}</td>
        <td>-$${totalInsumos.toFixed(0)}</td>
        <td>-$${totalVarios.toFixed(0)}</td>
        <td class="text-red">-$${totalExpenses.toFixed(0)}</td>
        <td class="${totalNet >= 0 ? 'text-green' : 'text-red'}">${totalNet > 0 ? '+' : ''}$${totalNet.toFixed(0)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>Documento Interno - BON Artesanal</div>
    <div class="signature-box">Revisión Contable</div>
  </div>
  
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    }
  </script>
</body>
</html>`;

  const existingIframe = document.getElementById('bon-print-frame-annual');
  if (existingIframe) existingIframe.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'bon-print-frame-annual';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
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
