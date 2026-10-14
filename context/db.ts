/**
 * db.ts — Capa de persistencia con IndexedDB (Dexie)
 * 
 * Reemplaza localStorage para eliminar el bloqueo síncrono del hilo principal.
 * Incluye migración automática one-time desde localStorage.
 */
import Dexie, { type Table } from 'dexie';
import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// 1. Definición del Schema de la Base de Datos
// ---------------------------------------------------------------------------

class BreweryDB extends Dexie {
  // Tablas de "documentos únicos" (key-value store style)
  kvStore!: Table<{ key: string; value: unknown }>;

  constructor() {
    super('BrewmasterDB');

    // Usamos una tabla key-value simple. Cada "estado" de la app es una fila.
    // Esto es más simple que definir una tabla con schema por cada tipo,
    // y mantiene la misma semántica que localStorage (get/set por key).
    this.version(1).stores({
      kvStore: 'key', // Primary key = 'key'
    });
  }
}

export const db = new BreweryDB();

// ---------------------------------------------------------------------------
// 2. Helpers de lectura/escritura asíncronos
// ---------------------------------------------------------------------------

/**
 * Lee un valor de IndexedDB. Si no existe, devuelve el fallback.
 */
export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const record = await db.kvStore.get(key);
    if (record === undefined || record.value === undefined || record.value === null) {
      return fallback;
    }
    // Validación extra: si fallback es array, asegurar que el valor también lo sea
    if (Array.isArray(fallback) && !Array.isArray(record.value)) {
      return fallback;
    }
    return record.value as T;
  } catch (e) {
    console.warn(`[DB] Error leyendo ${key}:`, e);
    return fallback;
  }
}

/**
 * Escribe un valor a IndexedDB de forma asíncrona (no bloquea la UI).
 */
export async function dbSet(key: string, value: unknown): Promise<void> {
  try {
    await db.kvStore.put({ key, value });
  } catch (e) {
    console.error(`[DB] Error escribiendo ${key}:`, e);
  }
}

// ---------------------------------------------------------------------------
// 3. Migración automática desde localStorage → IndexedDB (one-time)
// ---------------------------------------------------------------------------

const LS_KEYS_MAP: Record<string, string> = {
  brewmaster_batches: 'batches',
  brewmaster_inventory: 'inventory',
  brewmaster_kegs: 'kegs',
  brewmaster_bottles: 'bottles',
  brewmaster_sales: 'sales',
  brewmaster_expenses: 'expenses',
  brewmaster_customers: 'customers',
  brewmaster_payments: 'payments',
  brewmaster_settings: 'settings',
  brewmaster_financials: 'financialHistory',
  brewmaster_shoppinglist: 'shoppingList',
  brewmaster_recipes: 'masterRecipes',
  brewmaster_events: 'calendarEvents',
};

/**
 * Migra datos de localStorage a IndexedDB.
 * Solo ejecuta si IndexedDB está vacía (primera vez).
 * Devuelve true si migró datos, false si no era necesario.
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  try {
    // Verificar si ya migramos
    const migrationDone = await db.kvStore.get('_migration_v1');
    if (migrationDone) return false;

    console.log('[DB] Iniciando migración desde localStorage → IndexedDB...');

    const entries: { key: string; value: unknown }[] = [];

    for (const [lsKey, dbKey] of Object.entries(LS_KEYS_MAP)) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed !== null) {
            entries.push({ key: dbKey, value: parsed });
          }
        }
      } catch (e) {
        console.warn(`[DB] Error migrando ${lsKey}:`, e);
      }
    }

    if (entries.length > 0) {
      await db.kvStore.bulkPut(entries);
      console.log(`[DB] ✅ Migrados ${entries.length} registros a IndexedDB`);
    }

    // Marcar migración completa
    await db.kvStore.put({ key: '_migration_v1', value: true });

    // Opcional: limpiar localStorage para liberar espacio
    // (dejamos la data por seguridad — el usuario puede borrarla manualmente)
    console.log('[DB] ✅ Migración completa. Los datos de localStorage se mantienen como backup.');

    return entries.length > 0;
  } catch (e) {
    console.error('[DB] Error fatal en migración:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 4. Hook useDbState — reemplaza useState + useEffect de localStorage
// ---------------------------------------------------------------------------

/**
 * Hook que sincroniza un estado React con IndexedDB de forma asíncrona.
 * 
 * - La carga inicial es asíncrona (no bloquea el render)
 * - Los guardados usan requestIdleCallback para no bloquear la UI
 * - Incluye debounce para evitar escrituras excesivas
 * 
 * @returns [value, setValue, isLoaded] — isLoaded es false hasta que se carga de DB
 */
export function useDbState<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // Carga inicial desde IndexedDB
  useEffect(() => {
    let cancelled = false;

    dbGet<T>(key, fallback).then((loaded) => {
      if (!cancelled) {
        setValue(loaded);
        setIsLoaded(true);
        // Marcar que ya terminó la carga inicial
        // (necesitamos un frame extra para que React procese el setValue)
        requestAnimationFrame(() => {
          isInitialLoad.current = false;
        });
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Guardado asíncrono con debounce + requestIdleCallback
  useEffect(() => {
    // No guardar durante la carga inicial
    if (isInitialLoad.current) return;

    // Debounce 500ms para agrupar cambios rápidos
    if (pendingSave.current) clearTimeout(pendingSave.current);

    pendingSave.current = setTimeout(() => {
      // Usar requestIdleCallback si está disponible, sino setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          dbSet(key, value);
        }, { timeout: 2000 });
      } else {
        setTimeout(() => dbSet(key, value), 0);
      }
    }, 500);

    return () => {
      if (pendingSave.current) clearTimeout(pendingSave.current);
    };
  }, [key, value]);

  return [value, setValue, isLoaded];
}
