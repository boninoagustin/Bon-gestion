const fs = require('fs');
const path = require('path');

const dir = '/home/bon/Descargas/bon-gestion-1/components/calculators';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== 'Shared.tsx' && f !== 'ABVCalculator.tsx' && f !== 'IBUCalculator.tsx' && f !== 'WaterChemCalculator.tsx' && f !== 'EquipmentCalculator.tsx' && f !== 'RecipeCalculator.tsx' && f !== 'PitchCalculator.tsx');

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace slate with zinc
    content = content.replace(/slate-900/g, 'zinc-950');
    content = content.replace(/slate-800/g, 'zinc-900');
    content = content.replace(/slate-700\/50/g, 'zinc-900/60');
    content = content.replace(/slate-700/g, 'zinc-900/60');
    content = content.replace(/slate-600/g, 'zinc-700/80');
    content = content.replace(/slate-500/g, 'zinc-500');
    content = content.replace(/slate-400/g, 'zinc-400');
    content = content.replace(/slate-300/g, 'zinc-300');
    content = content.replace(/slate-200/g, 'zinc-200');
    content = content.replace(/slate-100/g, 'zinc-100');
    content = content.replace(/slate-50/g, 'zinc-50');

    // Make local buttons more glassmorphism
    content = content.replace(/className="([^"]*)p-2 rounded border/g, 'className="$1p-3 rounded-xl border-2 transition-all');
    content = content.replace(/className="([^"]*)p-3 rounded border/g, 'className="$1p-3 rounded-xl border-2 transition-all');
    content = content.replace(/rounded /g, 'rounded-xl ');
    content = content.replace(/rounded-lg/g, 'rounded-xl');

    // Alert boxes
    content = content.replace(/mb-4 bg-([a-z]+)-50 dark:bg-([a-z]+)-900\/20 text-([a-z]+)-900 dark:text-([a-z]+)-200 p-3/g, 'mb-5 bg-$1-50 dark:bg-$2-900/20 text-$3-900 dark:text-$4-300 p-4 shadow-sm');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Processed', file);
});
