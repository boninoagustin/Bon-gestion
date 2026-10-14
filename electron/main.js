
import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Corrección para Linux: Desactivar aceleración de hardware y sandbox si es necesario
// Esto soluciona problemas comunes donde la AppImage no abre en Ubuntu/Debian
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-site-isolation-trials');
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "BON",
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true
  });

  // En producción, carga el index.html construido
  win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.maximize();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // --- OPENAI OAUTH IPC ---
  ipcMain.handle('check-openai-status', async () => {
    try {
      const { openaiCredentials } = await import('@openai-oauth/local');
      const creds = openaiCredentials();
      const session = await creds.getSession();
      return { connected: true, accountId: session?.accountId || null };
    } catch (err) {
      return { connected: false };
    }
  });

  ipcMain.handle('login-openai', async () => {
    try {
      const { runOpenAIOAuthLogin } = await import('openai-oauth');
      await runOpenAIOAuthLogin();
      return { success: true };
    } catch (err) {
      console.error(err);
      return { error: err.message || "Error al abrir el inicio de sesión." };
    }
  });

  ipcMain.handle('logout-openai', async () => {
    try {
      const os = await import('node:os');
      const pathModule = await import('node:path');
      const fs = await import('node:fs/promises');
      const candidates = [
        process.env.CODEX_HOME ? pathModule.join(process.env.CODEX_HOME, 'auth.json') : null,
        pathModule.join(os.homedir(), '.codex', 'auth.json'),
        pathModule.join(os.homedir(), '.chatgpt-oauth', 'auth.json'),
      ].filter(Boolean);

      for (const p of candidates) {
        try {
          await fs.unlink(p);
        } catch (_) {}
      }
      return { success: true };
    } catch (err) {
      return { error: err.message || "Error al desvincular cuenta." };
    }
  });

  ipcMain.handle('get-openai-models', async () => {
    try {
      const { createOpenAIOAuthTransport } = await import('@openai-oauth/core');
      const { openaiCredentials } = await import('@openai-oauth/local');
      const creds = openaiCredentials();
      const session = await creds.getSession();
      if (!session) return { models: [] };

      const transport = createOpenAIOAuthTransport({
        auth: () => creds.getSession()
      });

      const response = await transport.fetch('https://api.openai.com/v1/models');
      if (response.ok) {
        const data = await response.json();
        return { models: data.data || [] };
      }
      return { models: [] };
    } catch (err) {
      console.warn("Could not fetch remote models:", err);
      return { models: [] };
    }
  });

  ipcMain.handle('ask-openai', async (event, contents, settings, rawTools) => {
    try {
      const { createOpenAIOAuth } = await import('@openai-oauth/ai-sdk');
      const { openaiCredentials } = await import('@openai-oauth/local');
      const { generateText, tool, jsonSchema } = await import('ai');

      let creds;
      try {
        creds = openaiCredentials();
        await creds.getSession();
      } catch (e) {
        return { error: "No se encontró una sesión activa de ChatGPT. Por favor haz clic en 'Vincular cuenta de ChatGPT' en Configuración." };
      }

      const openai = createOpenAIOAuth(creds);
      const modelName = settings?.chatGptModel || "gpt-6-astra";

      // Configurar herramientas si fueron provistas
      let toolsConfig = undefined;
      if (Array.isArray(rawTools) && rawTools.length > 0) {
        toolsConfig = {};
        for (const t of rawTools) {
          if (t && t.name) {
            toolsConfig[t.name] = tool({
              description: t.description || '',
              parameters: jsonSchema(t.parameters || { type: 'object', properties: {} })
            });
          }
        }
      }

      const result = await generateText({
        model: openai(modelName),
        messages: contents,
        tools: toolsConfig,
      });

      const toolCalls = (result.toolCalls || []).map(tc => ({
        name: tc.toolName,
        args: tc.input || tc.args
      }));

      return { text: result.text, toolCalls };
    } catch (err) {
      console.error("ask-openai error:", err);
      return { error: err.message || "Error al conectar con OpenAI a través de OAuth." };
    }
  });

  // --- NATIVE NOTIFICATIONS ---
  ipcMain.handle('send-notification', async (event, { title, body }) => {
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: title || 'BON Gestión Cervecera',
          body: body || '',
          icon: path.join(__dirname, '../build/icon.png')
        });
        notif.show();
        return { success: true };
      }
      return { supported: false };
    } catch (err) {
      console.error("Notification error:", err);
      return { error: err.message };
    }
  });

  // --- SILENT AUTOMATIC BACKUP ---
  ipcMain.handle('save-auto-backup', async (event, backupData) => {
    try {
      const fs = await import('node:fs/promises');
      const backupDir = path.join(app.getPath('userData'), 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `bon-autobackup-${dateStr}.json`;
      const filePath = path.join(backupDir, fileName);
      await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

      // Copia adicional en carpeta Documentos para fácil acceso
      try {
        const docDir = path.join(app.getPath('documents'), 'BON_Backups');
        await fs.mkdir(docDir, { recursive: true });
        await fs.writeFile(path.join(docDir, fileName), JSON.stringify(backupData, null, 2), 'utf-8');
      } catch (_) {}

      return { success: true, path: filePath };
    } catch (err) {
      console.error("Auto backup error:", err);
      return { error: err.message };
    }
  });

  ipcMain.handle('open-backup-folder', async () => {
    try {
      const docDir = path.join(app.getPath('documents'), 'BON_Backups');
      const fs = await import('node:fs/promises');
      await fs.mkdir(docDir, { recursive: true });
      await shell.openPath(docDir);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});