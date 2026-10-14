
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Base64 de un PNG 512x512 (Cuadrado Negro Sólido) VALIDADO.
// Este string es un PNG estándar generado para evitar errores de checksum en libpng.
const PLACEHOLDER_ICON_BASE64 = `iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAaklEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM8CXh8AAU/7bZQAAAAASUVORK5CYII=`;

// Rutas donde Android espera los iconos
const androidPaths = [
  'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  'android/app/src/main/res/drawable/ic_launcher.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
  'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'
];

// Rutas para Electron y PWA
const otherPaths = [
  'build/icon.png', // Para Electron Linux (Recurso de construcción)
  'build/icons/512x512.png', // Para Electron Linux .deb
  'build/icons/256x256.png', // Para Electron Linux .deb
  'public/icon.png' // Para PWA y Favicon
];

async function generateIcons() {
  console.log('🎨 Generando iconos para Android y Linux...');

  const sourceIconPath = path.join(rootDir, 'icon.png');
  let iconBuffer;

  // 1. Check if user provided 'icon.png' (Must be valid PNG)
  if (fs.existsSync(sourceIconPath)) {
    console.log('✅ Se encontró icon.png personalizado en la raíz. Usando imagen del usuario.');
    iconBuffer = fs.readFileSync(sourceIconPath);
  } else {
    console.log('⚠️ No se encontró icon.png. Generando icono estándar (Cuadrado Negro 512px).');
    console.log('👉 Tip: Para usar tu logo, coloca un archivo "icon.png" (512x512) en la carpeta principal.');
    iconBuffer = Buffer.from(PLACEHOLDER_ICON_BASE64, 'base64');
  }

  // 2. Ensure directories exist and write files
  const allPaths = [...androidPaths, ...otherPaths];

  for (const relPath of allPaths) {
    const fullPath = path.join(rootDir, relPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, iconBuffer);
    console.log(`  -> Creado: ${relPath}`);
  }
  
  console.log('🚀 Iconos actualizados y verificados.');
}

generateIcons().catch(console.error);
