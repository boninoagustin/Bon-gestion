const fs = require('fs');
const files = [
    '/home/bon/Descargas/bon-gestion-1/components/ShoppingListWidget.tsx',
    '/home/bon/Descargas/bon-gestion-1/components/FinancialSettingsModal.tsx',
    '/home/bon/Descargas/bon-gestion-1/components/dashboard/ExpensesModal.tsx',
    '/home/bon/Descargas/bon-gestion-1/components/dashboard/ProfitabilityModal.tsx',
    '/home/bon/Descargas/bon-gestion-1/components/dashboard/CloseMonthModal.tsx'
];
files.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/slate-900/g, 'zinc-950');
    content = content.replace(/slate-800/g, 'zinc-900');
    content = content.replace(/slate-700/g, 'zinc-700');
    content = content.replace(/slate-600/g, 'zinc-600');
    content = content.replace(/slate-500/g, 'zinc-500');
    content = content.replace(/slate-400/g, 'zinc-400');
    content = content.replace(/slate-300/g, 'zinc-300');
    content = content.replace(/slate-200/g, 'zinc-200');
    content = content.replace(/slate-100/g, 'zinc-100');
    content = content.replace(/slate-50/g, 'zinc-50');
    content = content.replace(/#f1f5f9/g, '#f4f4f5');
    content = content.replace(/rounded-lg/g, 'rounded-xl');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Processed', filePath);
});
