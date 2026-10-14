const fs = require('fs');

const filePath = '/home/bon/Descargas/bon-gestion-1/components/AiConsultant.tsx';
if (!fs.existsSync(filePath)) process.exit(1);

let content = fs.readFileSync(filePath, 'utf8');

// Safe replace slate with zinc
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

// Replace rounded-lg with rounded-xl
content = content.replace(/rounded-lg/g, 'rounded-xl');
content = content.replace(/rounded-2xl/g, 'rounded-3xl');

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Processed', filePath);
