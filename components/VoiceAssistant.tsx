import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, X, Loader2, Ear, Volume2, Sparkles } from 'lucide-react';
import { analyzeBrewingData } from '../services/geminiService';
import { useBreweryStore } from '../context/store';
import { buildAppSummary, AI_EVENTS } from '../services/ai/actions';
import { normalizeTranscript, toSpeechText, looksIncompleteUtterance } from '../services/ai/voiceText';

export const VoiceAssistant: React.FC = () => {
    const [isListeningWakeWord, setIsListeningWakeWord] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('bon_voice_wake_active') === 'true';
        }
        return false;
    });
    const isListeningWakeWordRef = useRef(isListeningWakeWord);
    const [isActiveCommand, setIsActiveCommand] = useState(false);
    const [commandTranscript, setCommandTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const conversationHistoryRef = useRef<{ role: 'user' | 'ai'; content: string }[]>([
        { role: 'ai', content: 'Soy BON, tu asistente por voz.' }
    ]);

    const recognitionRef = useRef<any>(null);
    const activeRecognitionRef = useRef<any>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const isActiveCommandRef = useRef(false);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const settings = useBreweryStore(s => s.settings);
    const updateSettings = useBreweryStore(s => s.updateSettings);

    const beep = (frequency = 880, duration = 150) => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const audioCtx = new AudioCtx();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            setTimeout(() => {
                try {
                    oscillator.stop();
                    audioCtx.close();
                } catch {}
            }, duration);
        } catch {}
    };

    // Escuchar eventos globales de timers de cocción para avisar por voz
    useEffect(() => {
        const handleTimerDone = (e: any) => {
            const label = e.detail?.label || 'un timer';
            beep(1200, 300);
            setTimeout(() => beep(1200, 300), 400);
            speak(`Atención: Sonó el timer de ${label}`);
        };
        window.addEventListener(AI_EVENTS.TIMER_DONE, handleTimerDone);
        return () => window.removeEventListener(AI_EVENTS.TIMER_DONE, handleTimerDone);
    }, []);

    const processCommand = async (command: string) => {
        if (!command.trim()) {
            closeAssistant();
            return;
        }

        setIsProcessing(true);
        try {
            // Pre-procesar texto de voz para que números dictados en palabras se normalicen a dígitos
            const cleanCommand = normalizeTranscript(command);
            const history = [...conversationHistoryRef.current.slice(-12), { role: 'user' as const, content: cleanCommand }];
            conversationHistoryRef.current = history;

            const appSummary = buildAppSummary();
            let response = await analyzeBrewingData(history, appSummary, settings, { isVoiceMode: true });

            // Procesar guardado de memoria a largo plazo si lo devolvió la IA
            const memoryRegex = /\[GUARDAR_MEMORIA:\s*"(.*?)"\]/i;
            const match = response.match(memoryRegex);
            if (match && match[1]) {
                const nuevaRegla = match[1];
                const memoriaActual = settings.aiLongTermMemory || '';
                updateSettings({
                    aiLongTermMemory: memoriaActual ? memoriaActual + '\n- ' + nuevaRegla : '- ' + nuevaRegla
                });
                response = response.replace(memoryRegex, '').trim();
            }

            conversationHistoryRef.current = [...history, { role: 'ai' as const, content: response }];
            setAiResponse(response);
            speak(response);
        } catch (err) {
            console.error('[VoiceAssistant] Error procesando comando:', err);
            const errText = "Hubo un problema de conexión al procesar la respuesta.";
            setAiResponse(errText);
            speak(errText);
        } finally {
            setIsProcessing(false);
        }
    };

    const speak = (text: string) => {
        if (!('speechSynthesis' in window)) {
            setTimeout(closeAssistant, 4000);
            return;
        }

        window.speechSynthesis.cancel();

        // Optimizar pronunciación de números, densidades y unidades para sintetizador en español
        const cleanText = toSpeechText(text);

        if (!cleanText) {
            closeAssistant();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);

        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(v =>
            v.lang.startsWith('es-AR') ||
            v.lang.startsWith('es-419') ||
            v.lang.startsWith('es-ES') ||
            v.lang.startsWith('es')
        );
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        } else {
            utterance.lang = 'es-AR';
        }

        utterance.rate = 1.05;

        utterance.onstart = () => {
            setIsSpeaking(true);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            utteranceRef.current = null;
            // Si el diálogo sigue activo, volver a escuchar para sostener la conversación naturalmente
            if (isActiveCommandRef.current) {
                setTimeout(() => {
                    if (isActiveCommandRef.current) {
                        activateCommandMode();
                    }
                }, 300);
            }
        };

        utterance.onerror = (e) => {
            console.warn("[VoiceAssistant] SpeechSynthesis cancelado o error:", e);
            setIsSpeaking(false);
            utteranceRef.current = null;
        };

        utteranceRef.current = utterance;

        setTimeout(() => {
            window.speechSynthesis.speak(utterance);
        }, 50);
    };

    const closeAssistant = (goodbyeMessage?: string) => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        if (activeRecognitionRef.current) {
            try {
                activeRecognitionRef.current.onend = null;
                activeRecognitionRef.current.abort();
            } catch {}
            activeRecognitionRef.current = null;
        }

        if (goodbyeMessage) {
            speak(goodbyeMessage);
            // Dejar que termine de hablar y luego cerrar el modal
            setTimeout(() => {
                setIsActiveCommand(false);
                isActiveCommandRef.current = false;
                setCommandTranscript('');
                setAiResponse('');
                setIsProcessing(false);
                resumeWakeWordIfEnabled();
            }, 1200);
            return;
        }

        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsActiveCommand(false);
        isActiveCommandRef.current = false;
        setCommandTranscript('');
        setAiResponse('');
        setIsProcessing(false);

        resumeWakeWordIfEnabled();
    };

    const resumeWakeWordIfEnabled = () => {
        if (isListeningWakeWordRef.current) {
            setTimeout(() => {
                if (!isActiveCommandRef.current && isListeningWakeWordRef.current) {
                    startWakeWordListener();
                }
            }, 600);
        }
    };

    // Wake word listener ("BON")
    const startWakeWordListener = () => {
        if (isActiveCommandRef.current) return;
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRec) return;

        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            try { recognitionRef.current.stop(); } catch {}
        }

        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-AR';

        recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase();

                // Detección con palabra completa (regex \b) para evitar falsos positivos con abono, bonito, carbono, etc.
                const wakeMatch = transcript.match(/\b(bon|bom|von)\b/i);
                if (wakeMatch) {
                    recognition.onend = null;
                    try { recognition.abort(); } catch {}

                    // Extraer lo que se haya dicho después de "BON" para no perder la pregunta
                    const afterWakeWord = transcript.slice((wakeMatch.index || 0) + wakeMatch[0].length).trim();
                    activateCommandMode(afterWakeWord);
                    break;
                }
            }
        };

        recognition.onend = () => {
            if (isListeningWakeWordRef.current && !isActiveCommandRef.current) {
                setTimeout(() => {
                    if (isListeningWakeWordRef.current && !isActiveCommandRef.current) {
                        try { recognition.start(); } catch {}
                    }
                }, 500);
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch {}
    };

    const activateCommandMode = (initialText = '') => {
        setIsActiveCommand(true);
        isActiveCommandRef.current = true;
        setIsProcessing(false);
        setCommandTranscript(initialText);
        setAiResponse('');
        beep(880, 160);

        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRec) {
            alert("Tu navegador no soporta reconocimiento de voz nativo. Puedes usar Google Chrome o Microsoft Edge.");
            closeAssistant();
            return;
        }

        if (activeRecognitionRef.current) {
            try { activeRecognitionRef.current.abort(); } catch {}
        }

        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-AR';

        let finalTranscript = initialText ? initialText + ' ' : '';
        let currentTranscript = initialText;
        let hasError = false;

        const resetSilenceTimer = (textSnippet = '') => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            // Si la última palabra indica que el usuario sigue dictando parámetros, dar más tiempo
            const waitMs = looksIncompleteUtterance(textSnippet) ? 3600 : 2500;
            silenceTimerRef.current = setTimeout(() => {
                if (activeRecognitionRef.current) {
                    try { activeRecognitionRef.current.stop(); } catch {}
                }
            }, waitMs);
        };

        recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            currentTranscript = (finalTranscript + interim).trim();
            resetSilenceTimer(currentTranscript);
            setCommandTranscript(currentTranscript);
        };

        recognition.onend = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (hasError) return;

            const textToProcess = currentTranscript.trim();
            const normalized = textToProcess
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[.,!?:;¿¡]/g, '')
                .trim();

            const words = normalized.split(/\s+/).filter(Boolean);

            // Palabras de despedida y cierre
            const closingPhrases = [
                'chau', 'adios', 'listo', 'ok', 'okey', 'okay', 'gracias', 'nada mas',
                'eso es todo', 'hasta luego', 'terminamos', 'bueno chau', 'ya esta'
            ];

            const isShortFarewell = words.length <= 4 && closingPhrases.some(p =>
                normalized === p ||
                normalized.startsWith(p + ' ') ||
                normalized.endsWith(' ' + p)
            );

            if (isShortFarewell) {
                setAiResponse('¡A tu disposición!');
                closeAssistant('¡A tu disposición! Hasta luego.');
                return;
            }

            if (textToProcess) {
                // Normalizar transcripción antes de procesar comando
                const normalizedCommand = normalizeTranscript(textToProcess);
                processCommand(normalizedCommand);
            } else {
                setCommandTranscript('No se escuchó nada...');
                setTimeout(() => closeAssistant(), 1800);
            }
        };

        recognition.onerror = (event: any) => {
            hasError = true;
            console.warn('[VoiceAssistant] Error en reconocimiento:', event.error);
            if (event.error !== 'aborted') {
                setCommandTranscript(`Micrófono: ${event.error}`);
                setTimeout(() => closeAssistant(), 2000);
            }
        };

        activeRecognitionRef.current = recognition;

        setTimeout(() => {
            if (isActiveCommandRef.current) {
                try {
                    recognition.start();
                    // Dar hasta 6 segundos iniciales antes de cortar si el usuario no dice nada
                    silenceTimerRef.current = setTimeout(() => {
                        if (activeRecognitionRef.current) {
                            try { activeRecognitionRef.current.stop(); } catch {}
                        }
                    }, 6000);
                } catch (e) {
                    console.error("[VoiceAssistant] Error iniciando micrófono:", e);
                    closeAssistant();
                }
            }
        }, 300);
    };

    useEffect(() => {
        if (isListeningWakeWord && !isActiveCommand) {
            startWakeWordListener();
        } else if (!isListeningWakeWord && recognitionRef.current) {
            recognitionRef.current.stop();
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (activeRecognitionRef.current) activeRecognitionRef.current.stop();
            window.speechSynthesis.cancel();
        };
    }, [isListeningWakeWord]);

    const toggleWakeWord = () => {
        const newVal = !isListeningWakeWord;
        setIsListeningWakeWord(newVal);
        isListeningWakeWordRef.current = newVal;
        if (typeof window !== 'undefined') {
            localStorage.setItem('bon_voice_wake_active', String(newVal));
        }
    };

    return (
        <>
            {/* Botones flotantes globales */}
            <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-center">
                {/* Botón manual para hablar inmediatamente */}
                <button
                    onClick={() => activateCommandMode()}
                    title="Hablar con BON"
                    className="p-4 rounded-full shadow-[0_0_25px_rgba(200,100,50,0.4)] transition-all duration-300 bg-copper text-zinc-950 hover:bg-copper/90 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                >
                    <Mic size={24} />
                </button>

                {/* Switch de escucha continua en segundo plano ("Di BON") */}
                <button
                    onClick={toggleWakeWord}
                    title={isListeningWakeWord ? "Escucha activa activa (Di 'BON')" : "Activar escucha continua ('BON')"}
                    className={`p-2.5 rounded-full shadow-lg transition-all duration-300 cursor-pointer ${
                        isListeningWakeWord
                            ? 'bg-zinc-800 text-copper border border-copper/50 animate-pulse'
                            : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
                    } backdrop-blur-sm`}
                >
                    <Ear size={18} />
                </button>
            </div>

            {/* Modal de comando de voz activo */}
            {isActiveCommand && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeIn">
                    <div className="w-11/12 max-w-lg bg-zinc-950/95 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative flex flex-col items-center">
                        <button
                            onClick={() => closeAssistant()}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-900 transition-colors cursor-pointer"
                            title="Cerrar"
                        >
                            <X size={22} />
                        </button>

                        <div className="relative mb-6">
                            <button
                                onClick={() => activateCommandMode()}
                                disabled={isProcessing}
                                className={`w-24 h-24 bg-zinc-900 rounded-full flex shrink-0 items-center justify-center shadow-[0_0_35px_rgba(200,100,50,0.35)] border border-copper/40 transition-transform hover:scale-105 active:scale-95 ${
                                    isSpeaking ? 'ring-4 ring-copper/50 animate-pulse' : ''
                                }`}
                                title="Toca para volver a hablar"
                            >
                                {isSpeaking ? (
                                    <Volume2 className="text-copper animate-bounce" size={42} />
                                ) : (
                                    <Mic className="text-copper" size={42} />
                                )}
                            </button>
                            {isProcessing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 rounded-full">
                                    <Loader2 size={36} className="text-copper animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={16} className="text-copper" />
                            <h2 className="text-2xl font-display font-bold text-white tracking-wide">BON te escucha</h2>
                        </div>

                        <p className="text-xs text-zinc-400 mb-4">
                            Di lo que necesitas o di <span className="text-copper font-semibold">"listo"</span> / <span className="text-copper font-semibold">"chau"</span> para terminar.
                        </p>

                        <div className="w-full min-h-[7rem] max-h-[16rem] overflow-y-auto flex flex-col items-center justify-start text-center px-3 py-2 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 custom-scrollbar">
                            <div className="my-auto w-full">
                                {isProcessing ? (
                                    <div className="flex flex-col items-center text-copper py-3">
                                        <p className="text-zinc-300 animate-pulse text-sm">Consultando y operando en la planta...</p>
                                    </div>
                                ) : aiResponse ? (
                                    <p className="text-lg text-zinc-100 leading-relaxed font-medium">
                                        "{aiResponse}"
                                    </p>
                                ) : (
                                    <p className="text-xl text-zinc-300 font-light italic">
                                        {commandTranscript || "Habla ahora..."}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Indicador de estado */}
                        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                            <span className={`w-2 h-2 rounded-full ${
                                isProcessing ? 'bg-amber-400 animate-ping' :
                                isSpeaking ? 'bg-copper animate-pulse' : 'bg-emerald-400 animate-pulse'
                            }`} />
                            <span>
                                {isProcessing ? 'Procesando' : isSpeaking ? 'Respondiendo' : 'Escuchando tu voz...'}
                            </span>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
