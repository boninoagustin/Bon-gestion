
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const androidDir = path.join(rootDir, 'android');

function run(command) {
    console.log(`\n> ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: rootDir });
    } catch (e) {
        console.error(`Error executing command: ${command}`);
        process.exit(1);
    }
}

async function buildApk() {
    console.log('🚀 Iniciando construcción de APK...');

    // 1. Instalar dependencias y Generar Iconos
    run('npm install');
    run('npm run icons');

    // 2. Construir Proyecto Web
    run('npm run build');

    // 3. Verificar estado de la plataforma Android
    const gradlewPath = path.join(androidDir, 'gradlew');
    
    // Si la carpeta existe pero le falta el archivo gradlew, está corrupta. La borramos.
    if (fs.existsSync(androidDir) && !fs.existsSync(gradlewPath)) {
        console.log('⚠️ Carpeta Android detectada pero incompleta (falta gradlew). Regenerando...');
        try {
            fs.rmSync(androidDir, { recursive: true, force: true });
        } catch (e) {
            console.warn('No se pudo borrar la carpeta android automáticamente. Intenta borrarla manual si falla.');
        }
    }

    // Crear plataforma si no existe
    if (!fs.existsSync(androidDir)) {
        console.log('📦 Creando proyecto Android nativo...');
        run('npx cap add android');
    } else {
        console.log('📦 Proyecto Android verificado.');
    }

    // 4. Sincronizar Assets
    console.log('🔄 Sincronizando código web con Android...');
    run('npx cap sync');

    // 5. Configurar SDK (local.properties)
    const localPropsPath = path.join(androidDir, 'local.properties');
    if (!fs.existsSync(localPropsPath)) {
        console.log('⚙️ Configurando ruta SDK Android...');
        // Asumimos ruta estándar de Linux si no está definida
        const sdkPath = process.env.ANDROID_HOME || `${process.env.HOME}/Android/Sdk`;
        fs.writeFileSync(localPropsPath, `sdk.dir=${sdkPath}\n`);
        console.log(`   -> SDK apuntado a: ${sdkPath}`);
    }

    // 6. Dar Permisos a Gradlew (Re-verificación)
    if (fs.existsSync(gradlewPath)) {
        console.log('🔑 Dando permisos de ejecución a Gradle...');
        try {
            fs.chmodSync(gradlewPath, '755');
        } catch (e) {
            // En Windows esto puede fallar y no es necesario, ignoramos
        }
    } else {
        console.error('❌ Error crítico: Aún no se encuentra el archivo gradlew. La generación de Android falló.');
        process.exit(1);
    }

    // 7. Compilar APK
    console.log('🔨 Compilando APK (Esto puede tardar unos minutos)...');
    try {
        // Usamos ./gradlew explícitamente para Linux/Mac
        execSync('./gradlew assembleDebug', { stdio: 'inherit', cwd: androidDir });
        console.log('\n✅ BUILD SUCCESSFUL!');
        console.log(`\n📂 Tu archivo APK está aquí:\n${path.join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk')}`);
    } catch (e) {
        console.error('\n❌ Falló la compilación de Android.');
        console.error('Posibles causas:');
        console.error('1. No tienes instalado Java (JDK). Ejecuta: sudo apt install default-jdk');
        console.error('2. No tienes el Android SDK. Abre Android Studio una vez para que se descargue.');
    }
}

buildApk();
