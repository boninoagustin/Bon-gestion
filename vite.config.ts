import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno desde el archivo .env (si existe)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: './', // Permite rutas relativas para Electron/Capacitor
    server: {
      host: true // Permite acceso red local
    },
    define: {
      // Inyectar la variable import.meta.env.VITE_GEMINI_API_KEY en la app compilada
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || '')
    }
  };
});