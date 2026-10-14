import { GoogleGenAI } from "@google/genai";
import { BrewerySettings } from "../types";
import { getSystemRules, buildContextPrompt } from "./ai/prompts";
import { aiTools, executeTool, WRITE_TOOLS } from "./ai/tools";

export interface AnalyzeOptions {
  isVoiceMode?: boolean;
}

export const analyzeBrewingData = async (
  messagesHistory: { role: 'user' | 'ai'; content: string }[],
  appData: string,
  settings?: BrewerySettings,
  options: AnalyzeOptions = {}
): Promise<string> => {
  try {
    const isVoice = !!options.isVoiceMode;
    const SYSTEM_RULES = getSystemRules(
      settings?.aiPersonality || '',
      settings?.aiLongTermMemory || '',
      isVoice
    );

    // Convertir historial a formato unificado
    const contents = messagesHistory.map((msg, index) => {
      let textToSend = msg.content || '';

      // Inyectar datos en el último mensaje de usuario
      if (index === messagesHistory.length - 1 && msg.role === 'user') {
        const dateTimeStr = new Date().toLocaleString('es-AR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        textToSend = buildContextPrompt(appData, msg.content, dateTimeStr);
      }

      return {
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: String(textToSend)
      };
    });

    const filteredContents = contents.filter(
      c => !(c.role === 'assistant' && c.content && (c.content.includes('Soy BrewMaster AI') || c.content.includes('Conversación reseteada')))
    );

    const trimmedContents = filteredContents.slice(-20);

    // --- OPCIÓN 1: CHATGPT VÍA ELECTRON IPC --- //
    if (settings?.aiProvider === 'chatgpt') {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        let openAiMessages = [
          { role: 'system', content: SYSTEM_RULES },
          ...trimmedContents
        ];

        let loopCount = 0;
        let finalResponseText = '';
        const executedToolsLog: string[] = [];

        // Loop de llamadas a herramientas (soporte multi-paso completo para OpenAI)
        while (loopCount < 5) {
          loopCount++;
          const response = await (window as any).electronAPI.askOpenAI(
            openAiMessages,
            settings,
            aiTools[0]?.functionDeclarations
          );

          if (response?.error) {
            return `⚠️ Inconveniente con ChatGPT: ${response.error}\n\n💡 Puedes cambiar temporalmente el motor a Google Gemini en Configuración (⚙️).`;
          }

          if (response?.toolCalls && response.toolCalls.length > 0) {
            // Ejecutar todas las herramientas solicitadas por OpenAI
            const toolResultsForChat: any[] = [];
            for (const call of response.toolCalls) {
              const res = executeTool(call.name, call.args);
              if (WRITE_TOOLS.has(call.name) && res?.success) {
                executedToolsLog.push(res.message || call.name);
              }
              toolResultsForChat.push({
                toolCallId: call.id || call.name,
                toolName: call.name,
                result: res
              });
            }

            // Alimentar la respuesta de las herramientas de vuelta a OpenAI para que genere su respuesta final informada
            openAiMessages.push({
              role: 'assistant',
              content: response.text || '',
              toolCalls: response.toolCalls
            } as any);

            openAiMessages.push({
              role: 'tool',
              content: JSON.stringify(toolResultsForChat)
            } as any);

            finalResponseText = response.text || '';
          } else {
            finalResponseText = response?.text || 'Acción completada.';
            break;
          }
        }

        if (executedToolsLog.length > 0 && !isVoice) {
          finalResponseText += `\n\n*(Acciones completadas: ${executedToolsLog.join(', ')})*`;
        }

        return finalResponseText;
      } else {
        return "No estás ejecutando la aplicación desde la versión de escritorio de BON (Electron). Vuelve a Google Gemini en Configuración (⚙️).";
      }
    }

    // --- OPCIÓN 2: GOOGLE GEMINI --- //
    const apiKey = settings?.apiKey || (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) || '';

    if (!apiKey) {
      // Fallback local en Modo Demo para consultas operativas clave
      const lastUserMsg = (messagesHistory[messagesHistory.length - 1]?.content || '').toLowerCase();
      
      if (lastUserMsg.includes('hacer hoy') || lastUserMsg.includes('agenda') || lastUserMsg.includes('resumen') || lastUserMsg.includes('plan')) {
        const b = executeTool('get_daily_briefing', {});
        const out: string[] = ['### 📋 Plan y Estado del Día (Modo Demo)\n'];
        
        // 1. Agenda
        if (b.eventsToday && b.eventsToday.length > 0) {
          out.push(`**📅 Agenda de Hoy:**\n${b.eventsToday.map((e: any) => `- ${e.title}`).join('\n')}\n`);
        } else {
          out.push(`**📅 Agenda de Hoy:** No tenés eventos agendados para hoy.\n`);
        }
        if (b.overdueEvents && b.overdueEvents.length > 0) {
          out.push(`**⚠️ Tareas Atrasadas:**\n${b.overdueEvents.map((e: any) => `- ${e.title} (${e.date})`).join('\n')}\n`);
        }

        // 2. Limpieza y CIP
        const dirtyF = b.dirtyFermenters || [];
        const dirtyK = b.dirtyKegs || [];
        if (dirtyF.length > 0 || dirtyK.length > 0) {
          out.push(`**🧼 Limpieza y Sanitización (CIP):**`);
          if (dirtyF.length > 0) out.push(`- 🛢️ **Fermentadores sucios para CIP:** ${dirtyF.map((f: any) => f.name).join(', ')}. Conviene lavarlos y sanitizarlos para dejarlos disponibles.`);
          if (dirtyK.length > 0) out.push(`- 🪣 **Barriles sucios:** ${dirtyK.length} barril(es) para lavar (${dirtyK.join(', ')}).`);
          out.push('');
        } else {
          out.push(`**🧼 Limpieza:** Todos los fermentadores y barriles están limpios y listos.\n`);
        }

        // 3. Cobranzas
        if (b.topDebtors && b.topDebtors.length > 0) {
          out.push(`**💸 Cobranzas pendientes:**`);
          b.topDebtors.forEach((c: any) => out.push(`- **${c.name}:** debe $${c.debt}${c.contact ? ` (Tel: ${c.contact})` : ''} → Te sugiero llamarlo para coordinar el cobro.`));
          out.push('');
        }

        // 4. Stock crítico
        if ((b.outOfStock && b.outOfStock.length > 0) || (b.lowStock && b.lowStock.length > 0)) {
          out.push(`**📦 Stock Crítico:**`);
          if (b.outOfStock && b.outOfStock.length > 0) out.push(`- ❌ **Sin stock:** ${b.outOfStock.join(', ')}`);
          if (b.lowStock && b.lowStock.length > 0) out.push(`- ⚠️ **Stock bajo:** ${b.lowStock.map((i: any) => `${i.name} (${i.stock} ${i.unit})`).join(', ')}`);
          out.push('');
        }

        // 5. Lotes en fermentación
        if (b.fermenting && b.fermenting.length > 0) {
          out.push(`**🍺 Lotes en producción:**`);
          b.fermenting.forEach((l: any) => {
            const ferm = l.fermenter ? ` en **${l.fermenter}**` : '';
            const grav = l.lastGravity ? `, densidad actual: ${l.lastGravity}` : '';
            const temp = l.lastTemp !== undefined ? `, temp: ${l.lastTemp}°C` : '';
            const days = l.days !== undefined ? `, día ${l.days}` : '';
            out.push(`- **${l.recipe}** [${l.lotCode}] (${l.status})${ferm}${days}${grav}${temp}`);
          });
          out.push('');
        }

        out.push(`\n*(💡 Modo Demo: resumen generado con tus datos locales. Para hablar libremente por voz o chat conversacional con la IA, ingresá tu API Key en Configuración ⚙️)*`);
        return out.join('\n');
      }

      if (lastUserMsg.includes('fermentador') || lastUserMsg.includes('tanque')) {
        const fermRes = executeTool('get_fermenters_status', {});
        const out: string[] = ['### 🛢️ Estado de Fermentadores (Modo Demo)\n'];
        if (fermRes.fermenters && fermRes.fermenters.length > 0) {
          fermRes.fermenters.forEach((f: any) => {
            const batchInfo = f.currentBatch ? ` → **Ocupado** con ${f.currentBatch.recipeName} (${f.currentBatch.lotCode}) - Día ${f.currentBatch.daysInTank ?? '?'}, OG ${f.currentBatch.originalGravity ?? '?'}${f.currentBatch.lastGravity ? `, actual ${f.currentBatch.lastGravity}` : ''}` : ` → Estado: **${f.status}**`;
            out.push(`- **${f.name}** (${f.capacity}L)${batchInfo}`);
          });
          out.push(`\n**Resumen:** ${fermRes.available} disponibles | ${fermRes.occupied} ocupados | ${fermRes.dirty} sucios para CIP | ${fermRes.maintenance} en mantenimiento.`);
        } else {
          out.push('No tenés fermentadores registrados todavía.');
        }
        out.push(`\n*(💡 Modo Demo: para activar el asistente de IA completo con comandos automáticos, cargá tu API Key en Configuración ⚙️)*`);
        return out.join('\n');
      }

      if (lastUserMsg.includes('lote') || lastUserMsg.includes('produccion') || lastUserMsg.includes('coccion')) {
        const batchesRes = executeTool('get_active_batches', {});
        const active = batchesRes.activeBatches || [];
        const out: string[] = ['### 🍺 Lotes en Producción (Modo Demo)\n'];
        if (active.length > 0) {
          active.forEach((b: any) => {
            const ferm = b.fermenterName ? ` en **${b.fermenterName}**` : '';
            const days = b.daysSinceBrew !== undefined ? ` (Día ${b.daysSinceBrew})` : '';
            const grav = b.lastGravityReading ? ` | Densidad actual: ${b.lastGravityReading}` : (b.originalGravity ? ` | OG: ${b.originalGravity}` : '');
            const temp = b.lastTemperatureReading !== undefined ? ` | Temp: ${b.lastTemperatureReading}°C` : '';
            out.push(`- **${b.recipeName}** [${b.lotCode}] - Estado: **${b.status}**${ferm}${days}${grav}${temp}`);
          });
        } else {
          out.push('No hay lotes activos en este momento.');
        }
        out.push(`\n*(💡 Modo Demo: para activar el asistente de IA completo con comandos automáticos, cargá tu API Key en Configuración ⚙️)*`);
        return out.join('\n');
      }

      return "Para usar el asistente completo con Google Gemini o ChatGPT, ingresa tu API Key en Configuración (ícono ⚙️).\n\nEn Modo Demo podés hacerme consultas directas como:\n- *\"¿Qué tengo para hacer hoy?\"*\n- *\"¿Cuál es el estado de los fermentadores?\"*\n- *\"¿Cómo van los lotes en producción?\"*";
    }

    const ai = new GoogleGenAI({ apiKey });

    const geminiContents = trimmedContents.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    let currentContents: any[] = [...geminiContents];

    const generateWithTimeout = async (options: any) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 25000);
      });
      return Promise.race([
        ai.models.generateContent(options),
        timeoutPromise
      ]) as Promise<any>;
    };

    let response = await generateWithTimeout({
      model: 'gemini-2.5-flash',
      contents: currentContents,
      config: {
        systemInstruction: SYSTEM_RULES,
        tools: aiTools as any,
      },
    });

    // Loop multi-tool: iterar hasta que la IA termine o alcance el tope de pasos
    let iterations = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 5) {
      iterations++;
      const functionResponses: any[] = [];
      const modelParts: any[] = [];

      for (const call of response.functionCalls) {
        const result = executeTool(call.name, call.args);
        modelParts.push({ functionCall: { name: call.name, args: call.args } });
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: result
          }
        });
      }

      currentContents.push({
        role: 'model',
        parts: modelParts
      });

      currentContents.push({
        role: 'user',
        parts: functionResponses
      });

      response = await generateWithTimeout({
        model: 'gemini-2.5-flash',
        contents: currentContents,
        config: {
          systemInstruction: SYSTEM_RULES,
          tools: aiTools as any,
        },
      });
    }

    if (!response || !response.text) {
      return "Acción completada.";
    }

    return response.text;
  } catch (error) {
    console.error("Error calling AI service:", error);
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes('API_KEY') || errMsg.includes('API key') || errMsg.includes('403') || errMsg.includes('401')) {
      return "Error de autenticación: La API Key de Gemini no es válida o no tiene permisos. Verifícala en Configuración.";
    }
    if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate')) {
      return "Límite de cuota alcanzado en la API. Por favor espera un minuto antes de consultar de nuevo.";
    }
    if (errMsg.includes('timeout')) {
      return "La respuesta tardó más de lo esperado. Por favor intenta reformular tu pedido.";
    }
    if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('ENOTFOUND')) {
      return "Error de conexión: Verifica tu conexión a internet.";
    }

    return "Hubo un error al procesar la respuesta con el asistente inteligente. Por favor intenta de nuevo.";
  }
};