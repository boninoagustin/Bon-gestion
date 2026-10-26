/**
 * @fileoverview db.ts — Capa de persistencia local ACID con IndexedDB (Dexie.js) para Bon-Gestión.
 *
 * Responsabilidades principales:
 * 1. Consistencia ACID local:
 *    - Escrituras multi-entidad atómicas mediante `db.transaction('rw', ...)`.
 *    - Transacciones de dominio para operaciones críticas de stock:
 *      consumo de malta/insumos en cocción, envasado a barril, embotellado desde barril y ventas en Taproom.
 *    - Libro mayor de auditoría de stock (`stockLedger`) dentro de la misma transacción `'rw'`.
 *    - Cola de persistencia transaccional serializada (`scheduleTransactionalSave`) que agrupa mutaciones
 *      rápidas en un único commit atómico, eliminando condiciones de carrera (Hallazgo A004).
 * 2. Esquema de versionado y migraciones seguras:
 *    - Evolución incremental `version(1)` → `version(2)` → `version(3)` con `.upgrade()` no destructivo.
 *    - Manejo automático de evento `versionchange` y timeout en `ensureDbReady()` para evitar bloqueos
 *      cuando el usuario actualiza de la versión 1 a la versión 3 con otra pestaña abierta.
 *    - Migración idempotente con lock en memoria desde `localStorage` (resuelve Hallazgo A005).
 * 3. Manejo global de excepciones y resiliencia ante corrupción:
 *    - Clasificación descriptiva de errores de IndexedDB (`QuotaExceededError`, `VersionError`, `InvalidStateError`, etc.).
 *    - Integración con `lib/errorLogger.ts` y modo degradado en memoria con respaldo de emergencia
 *      para evitar pantallas en blanco si el almacenamiento del navegador falla o se corrompe.
 */

import Dexie, { type Table, type Transaction } from 'dexie';
import React, { useState, useEffect, useRef } from 'react';
import { logError } from '../lib/errorLogger';
import {
  Batch,
  BatchStatus,
  BottleStock,
  Customer,
  Expense,
  Fermenter,
  Ingredient,
  Keg,
  Sale,
} from '../types';

// ============================================================================
// 1. TIPOS E INTERFACES DE PERSISTENCIA Y AUDITORÍA ACID
// ============================================================================

/** Claves válidas de colecciones persistidas en `kvStore` */
export type PersistedCollectionKey =
  | 'batches'
  | 'inventory'
  | 'kegs'
  | 'bottles'
  | 'fermenters'
  | 'sales'
  | 'expenses'
  | 'customers'
  | 'payments'
  | 'financialHistory'
  | 'settings'
  | 'shoppingList'
  | 'masterRecipes'
  | 'calendarEvents'
  | 'annualOverrides'
  | 'brewSessions';

/** Registro clave-valor almacenado en la tabla principal de estado */
export interface KvRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt?: string;
  schemaVersion?: number;
}

/** Tipo de operación crítica de inventario registrada en el libro mayor ACID */
export type StockOperationType =
  | 'CONSUME_MALT_AND_INGREDIENTS'
  | 'PACKAGE_TO_KEG'
  | 'BOTTLE_FROM_KEG'
  | 'TAPROOM_SALE'
  | 'TAPROOM_GIFT'
  | 'MANUAL_STOCK_ADJUSTMENT'
  | 'BATCH_Rollback';

/** Registro inmutable de auditoría de movimientos de stock */
export interface StockLedgerEntry {
  id?: number;
  timestamp: string;
  operation: StockOperationType;
  entityId: string;
  lotCode?: string;
  description: string;
  deltas: {
    collection: PersistedCollectionKey;
    itemId: string;
    previousValue: number | string;
    newValue: number | string;
    unit?: string;
  }[];
}

/** Metadatos internos de versión y salud de la base de datos */
export interface DbMetaRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

/** Códigos de diagnóstico de errores de IndexedDB */
export type DbErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'CORRUPTED_DB'
  | 'VERSION_ERROR'
  | 'DATABASE_CLOSED'
  | 'TRANSACTION_ABORTED'
  | 'DATA_VALIDATION_ERROR'
  | 'UNKNOWN_IDB_ERROR';

/** Estado de salud observable de la base de datos local */
export interface DbHealthStatus {
  healthy: boolean;
  degradedMode: boolean;
  schemaVersion: number;
  lastError: {
    code: DbErrorCode;
    message: string;
    context: string;
    timestamp: string;
  } | null;
  lastSuccessfulSyncAt: string | null;
}

// ============================================================================
// 2. MANEJO GLOBAL DE EXCEPCIONES Y DIAGNÓSTICO DE CORRUPCIÓN
// ============================================================================

export const CURRENT_DB_SCHEMA_VERSION = 3;
const EMERGENCY_BACKUP_LS_KEY = 'brewmaster_emergency_backup_v3';

let dbHealth: DbHealthStatus = {
  healthy: true,
  degradedMode: false,
  schemaVersion: CURRENT_DB_SCHEMA_VERSION,
  lastError: null,
  lastSuccessfulSyncAt: null,
};

const healthListeners = new Set<(status: DbHealthStatus) => void>();

/**
 * Notifica a los suscriptores cualquier cambio en la salud de IndexedDB.
 */
function notifyHealthListeners(): void {
  const snapshot: DbHealthStatus = {
    ...dbHealth,
    lastError: dbHealth.lastError ? { ...dbHealth.lastError } : null,
  };
  healthListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignorar errores en listeners de UI
    }
  });
}

/**
 * Obtiene el estado actual de salud de IndexedDB.
 */
export function getDbHealthStatus(): DbHealthStatus {
  return {
    ...dbHealth,
    lastError: dbHealth.lastError ? { ...dbHealth.lastError } : null,
  };
}

/**
 * Permite suscribirse a cambios de salud/errores de la base de datos local.
 * @returns Función para cancelar la suscripción.
 */
export function subscribeDbHealth(
  listener: (status: DbHealthStatus) => void
): () => void {
  healthListeners.add(listener);
  listener(getDbHealthStatus());
  return () => {
    healthListeners.delete(listener);
  };
}

/**
 * Clasifica una excepción de Dexie/IndexedDB en un código de diagnóstico claro.
 */
function classifyDbError(error: unknown): DbErrorCode {
  const name = error instanceof Error ? error.name : '';
  const msg = error instanceof Error ? error.message : String(error);

  if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
    return 'QUOTA_EXCEEDED';
  }
  if (name === 'VersionError' || /version/i.test(msg)) {
    return 'VERSION_ERROR';
  }
  if (
    name === 'InvalidStateError' ||
    name === 'UnknownError' ||
    /corrupt|backing store|internal error/i.test(msg)
  ) {
    return 'CORRUPTED_DB';
  }
  if (name === 'DatabaseClosedError' || /closed/i.test(msg)) {
    return 'DATABASE_CLOSED';
  }
  if (name === 'AbortError' || /abort/i.test(msg)) {
    return 'TRANSACTION_ABORTED';
  }
  if (name === 'DataError' || /data/i.test(msg)) {
    return 'DATA_VALIDATION_ERROR';
  }
  return 'UNKNOWN_IDB_ERROR';
}

/**
 * Registra de forma descriptiva cualquier error de base de datos sin romper el renderizado de React.
 */
export function reportDbException(
  context: string,
  error: unknown,
  markDegraded: boolean = false
): DbErrorCode {
  const code = classifyDbError(error);
  const rawMessage = error instanceof Error ? error.message : String(error);
  const descriptiveMessage = `[BreweryDB:${code}] Fallo en "${context}": ${rawMessage}`;

  console.error(descriptiveMessage, error);

  const normalizedError =
    error instanceof Error
      ? new Error(descriptiveMessage, { cause: error })
      : new Error(descriptiveMessage);

  logError(normalizedError, `IndexedDB Context: ${context} (Code: ${code})`);

  dbHealth = {
    ...dbHealth,
    healthy: !markDegraded && code !== 'CORRUPTED_DB',
    degradedMode: dbHealth.degradedMode || markDegraded || code === 'CORRUPTED_DB',
    lastError: {
      code,
      message: descriptiveMessage,
      context,
      timestamp: new Date().toISOString(),
    },
  };

  notifyHealthListeners();
  return code;
}

// ============================================================================
// 3. DEFINICIÓN DEL ESQUEMA VERSIONADO EN DEXIE Y MIGRACIONES NO DESTRUCTIVAS
// ============================================================================

export class BreweryDB extends Dexie {
  /** Almacén transaccional de colecciones de estado (compatible con v1) */
  kvStore!: Table<KvRecord, string>;
  /** Libro mayor inmutable de transacciones de stock (añadido en v2) */
  stockLedger!: Table<StockLedgerEntry, number>;
  /** Metadatos de migración, versión e integridad (añadido en v2) */
  meta!: Table<DbMetaRecord, string>;

  constructor() {
    super('BrewmasterDB');

    // Versión 1: Esquema original Key-Value
    this.version(1).stores({
      kvStore: 'key',
    });

    // Versión 2: Incorporación de libro mayor de auditoría ACID y tabla de metadatos
    this.version(2)
      .stores({
        kvStore: 'key',
        stockLedger: '++id, timestamp, operation, entityId, lotCode',
        meta: 'key',
      })
      .upgrade(async (tx: Transaction) => {
        try {
          const kvTable = tx.table<KvRecord, string>('kvStore');
          const metaTable = tx.table<DbMetaRecord, string>('meta');
          const now = new Date().toISOString();

          // Normalizar estados históricos de lotes sin borrar datos del usuario
          const batchesRec = await kvTable.get('batches');
          if (batchesRec && Array.isArray(batchesRec.value)) {
            const migratedBatches = (batchesRec.value as Batch[]).map((b) => ({
              ...b,
              status:
                (b.status as unknown as string) === 'Envasado'
                  ? BatchStatus.PACKAGED
                  : b.status,
              fermentationLogs: Array.isArray(b.fermentationLogs)
                ? b.fermentationLogs
                : [],
              sensoryProfiles: Array.isArray(b.sensoryProfiles)
                ? b.sensoryProfiles
                : [],
              qualityLogs: Array.isArray(b.qualityLogs) ? b.qualityLogs : [],
              ingredientsUsed: Array.isArray(b.ingredientsUsed)
                ? b.ingredientsUsed
                : [],
            }));
            await kvTable.put({
              key: 'batches',
              value: migratedBatches,
              updatedAt: now,
              schemaVersion: 2,
            });
          }

          await metaTable.put({
            key: 'schema_version',
            value: 2,
            updatedAt: now,
          });
        } catch (err) {
          reportDbException('upgrade_v1_to_v2', err, false);
        }
      });

    // Versión 3: Índices compuestos en stockLedger y normalización de integridad de fermentadores/barriles
    this.version(3)
      .stores({
        kvStore: 'key, updatedAt',
        stockLedger:
          '++id, timestamp, operation, entityId, lotCode, [operation+timestamp]',
        meta: 'key, updatedAt',
      })
      .upgrade(async (tx: Transaction) => {
        try {
          const kvTable = tx.table<KvRecord, string>('kvStore');
          const metaTable = tx.table<DbMetaRecord, string>('meta');
          const now = new Date().toISOString();

          // Garantizar que los barriles tengan currentVolume numérico coherente con su capacidad
          const kegsRec = await kvTable.get('kegs');
          if (kegsRec && Array.isArray(kegsRec.value)) {
            const normalizedKegs = (kegsRec.value as Keg[]).map((k) => ({
              ...k,
              currentVolume:
                typeof k.currentVolume === 'number' &&
                Number.isFinite(k.currentVolume)
                  ? Math.max(0, k.currentVolume)
                  : k.status === 'DIRTY'
                  ? 0
                  : k.size,
            }));
            await kvTable.put({
              key: 'kegs',
              value: normalizedKegs,
              updatedAt: now,
              schemaVersion: 3,
            });
          }

          await metaTable.put({
            key: 'schema_version',
            value: 3,
            updatedAt: now,
          });
        } catch (err) {
          reportDbException('upgrade_v2_to_v3', err, false);
        }
      });

    // Si otra pestaña solicita una actualización de versión de IndexedDB, cerrar conexión gentilmente
    this.on('versionchange', () => {
      this.close();
    });

    this.on('blocked', () => {
      console.warn(
        '[BreweryDB] Actualización de versión IndexedDB bloqueada temporalmente por otra pestaña abierta.'
      );
    });
  }
}

export const db = new BreweryDB();

// Cache en memoria de respaldo en caso de corrupción de IndexedDB
const memoryFallbackStore = new Map<string, unknown>();

// ============================================================================
// 4. RECUPERACIÓN AUTOMÁTICA ANTE CORRUPCIÓN O BLOQUEO DE BASE DE DATOS LOCAL
// ============================================================================

let dbOpenPromise: Promise<boolean> | null = null;
const DB_OPEN_TIMEOUT_MS = 2000;

/**
 * Intenta abrir la base de datos con un timeout de protección (`2000ms`) por si otra pestaña
 * bloquea el upgrade de `version(1)` → `version(3)`. Si detecta bloqueo o corrupción,
 * activa el modo resiliente para evitar que la aplicación quede en pantalla de carga.
 */
export async function ensureDbReady(): Promise<boolean> {
  if (db.isOpen()) return true;
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = (async (): Promise<boolean> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const openRace = await Promise.race<boolean>([
        db.open().then(() => true),
        new Promise<boolean>((resolve) => {
          timeoutHandle = setTimeout(() => {
            console.warn(
              '[BreweryDB] db.open() demoró más de 2000ms (posible pestaña antigua bloqueando upgrade). Continuando sin bloquear la UI.'
            );
            resolve(false);
          }, DB_OPEN_TIMEOUT_MS);
        }),
      ]);

      if (openRace) {
        dbHealth.healthy = true;
        return true;
      }
      return db.isOpen();
    } catch (err) {
      const code = reportDbException('ensureDbReady:open', err, true);
      if (code === 'CORRUPTED_DB' || code === 'VERSION_ERROR') {
        console.warn(
          '[BreweryDB] Activando modo de contingencia en memoria para evitar pantalla en blanco.'
        );
      }
      return false;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      dbOpenPromise = null;
    }
  })();

  return dbOpenPromise;
}

// ============================================================================
// 5. LECTURA Y ESCRITURA TRANSACCIONAL ACID
// ============================================================================

/**
 * Lee un valor de IndexedDB de forma segura. Si no existe o ocurre un error de lectura,
 * devuelve el `fallback` tipado sin lanzar excepciones no controladas.
 *
 * @param key - Clave de la colección (ej. `'batches'`, `'inventory'`).
 * @param fallback - Valor por defecto en caso de ausencia o corrupción.
 */
export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const ready = await ensureDbReady();
    if (!ready) {
      if (memoryFallbackStore.has(key)) {
        return memoryFallbackStore.get(key) as T;
      }
      return fallback;
    }

    const record = await db.kvStore.get(key);
    if (
      record === undefined ||
      record.value === undefined ||
      record.value === null
    ) {
      return fallback;
    }

    if (Array.isArray(fallback) && !Array.isArray(record.value)) {
      console.warn(
        `[BreweryDB] Tipo inesperado en clave "${key}" (se esperaba Array). Usando fallback seguro.`
      );
      return fallback;
    }

    memoryFallbackStore.set(key, record.value);
    return record.value as T;
  } catch (e) {
    reportDbException(`dbGet(${key})`, e, false);
    if (memoryFallbackStore.has(key)) {
      return memoryFallbackStore.get(key) as T;
    }
    return fallback;
  }
}

/**
 * Escribe un valor en IndexedDB dentro de una transacción `'rw'` atómica.
 *
 * @param key - Clave a persistir.
 * @param value - Estado serializable a guardar.
 */
export async function dbSet(key: string, value: unknown): Promise<void> {
  memoryFallbackStore.set(key, value);
  try {
    const ready = await ensureDbReady();
    if (!ready) return;

    const now = new Date().toISOString();
    await db.transaction('rw', db.kvStore, async () => {
      await db.kvStore.put({
        key,
        value,
        updatedAt: now,
        schemaVersion: CURRENT_DB_SCHEMA_VERSION,
      });
    });

    dbHealth.lastSuccessfulSyncAt = now;
  } catch (e) {
    reportDbException(`dbSet(${key})`, e, false);
  }
}

/**
 * Ejecuta una escritura atómica multi-colección dentro de una única transacción
 * `db.transaction('rw', ...)` de Dexie, registrando opcionalmente un asiento en `stockLedger`.
 *
 * Si cualquier operación dentro de la transacción falla, IndexedDB revierte
 * automáticamente todos los cambios (garantía ACID Todo-o-Nada).
 *
 * @param entries - Mapa o lista de pares `{ key, value }` que deben actualizarse juntos.
 * @param ledgerEntry - Asiento opcional en el libro mayor de stock (`stockLedger`).
 */
export async function dbCommitTransaction(
  entries: Record<string, unknown>,
  ledgerEntry?: Omit<StockLedgerEntry, 'id' | 'timestamp'>
): Promise<boolean> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return true;

  // Actualizar cache en memoria
  for (const [k, v] of Object.entries(entries)) {
    memoryFallbackStore.set(k, v);
  }

  try {
    const ready = await ensureDbReady();
    if (!ready) {
      saveEmergencySnapshotToLocalStorage(entries);
      return false;
    }

    const now = new Date().toISOString();
    const records: KvRecord[] = Object.entries(entries).map(([key, value]) => ({
      key,
      value,
      updatedAt: now,
      schemaVersion: CURRENT_DB_SCHEMA_VERSION,
    }));

    const tablesToLock =
      ledgerEntry && db.stockLedger
        ? [db.kvStore, db.stockLedger, db.meta]
        : [db.kvStore, db.meta];

    await db.transaction('rw', tablesToLock, async () => {
      await db.kvStore.bulkPut(records);

      if (ledgerEntry && db.stockLedger) {
        await db.stockLedger.add({
          ...ledgerEntry,
          timestamp: now,
        });
      }

      if (db.meta) {
        await db.meta.put({
          key: 'last_acid_commit',
          value: { keys, operation: ledgerEntry?.operation ?? 'STATE_SYNC' },
          updatedAt: now,
        });
      }
    });

    dbHealth.lastSuccessfulSyncAt = now;
    return true;
  } catch (e) {
    reportDbException(
      `dbCommitTransaction([${keys.join(', ')}])`,
      e,
      false
    );
    saveEmergencySnapshotToLocalStorage(entries);
    return false;
  }
}

/**
 * Resguarda un snapshot compacto en `localStorage` cuando IndexedDB falla por corrupción o cuota.
 */
function saveEmergencySnapshotToLocalStorage(
  partialEntries: Record<string, unknown>
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const existingRaw = localStorage.getItem(EMERGENCY_BACKUP_LS_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = {
      ...existing,
      ...partialEntries,
      _emergencySavedAt: new Date().toISOString(),
    };
    localStorage.setItem(EMERGENCY_BACKUP_LS_KEY, JSON.stringify(merged));
  } catch {
    // Ignorar si localStorage también alcanzó límite de cuota
  }
}

// ============================================================================
// 6. TRANSACCIONES ACID DE DOMINIO CERVECERO (STOCK, ENVASADO Y TAPROOM)
// ============================================================================

/**
 * Transacción ACID 1: Consumo de malta e insumos al cocinar/finalizar un lote.
 * Actualiza de forma atómica `batches`, `inventory`, `fermenters` y registra el asiento en `stockLedger`.
 */
export async function txConsumeIngredientsForBatch(params: {
  batches: Batch[];
  inventory: Ingredient[];
  fermenters: Fermenter[];
  batchId: string;
  lotCode?: string;
  deltas: StockLedgerEntry['deltas'];
}): Promise<boolean> {
  return dbCommitTransaction(
    {
      batches: params.batches,
      inventory: params.inventory,
      fermenters: params.fermenters,
    },
    {
      operation: 'CONSUME_MALT_AND_INGREDIENTS',
      entityId: params.batchId,
      lotCode: params.lotCode,
      description: `Consumo ACID de insumos para lote ${params.lotCode || params.batchId}`,
      deltas: params.deltas,
    }
  );
}

/**
 * Transacción ACID 2: Envasado de lote a barril (`fillKegFromBatch`).
 * Actualiza atómicamente `kegs`, `batches` y `fermenters` en una sola transacción `'rw'`.
 */
export async function txPackageBatchToKeg(params: {
  kegs: Keg[];
  batches: Batch[];
  fermenters: Fermenter[];
  kegId: string;
  batchId: string;
  lotCode?: string;
  litersPackaged: number;
  previousBatchVolume: number;
  newBatchVolume: number;
}): Promise<boolean> {
  return dbCommitTransaction(
    {
      kegs: params.kegs,
      batches: params.batches,
      fermenters: params.fermenters,
    },
    {
      operation: 'PACKAGE_TO_KEG',
      entityId: params.kegId,
      lotCode: params.lotCode,
      description: `Envasado de ${params.litersPackaged}L del lote ${params.lotCode || params.batchId} al barril #${params.kegId}`,
      deltas: [
        {
          collection: 'batches',
          itemId: params.batchId,
          previousValue: params.previousBatchVolume,
          newValue: params.newBatchVolume,
          unit: 'L',
        },
        {
          collection: 'kegs',
          itemId: params.kegId,
          previousValue: 0,
          newValue: params.litersPackaged,
          unit: 'L',
        },
      ],
    }
  );
}

/**
 * Transacción ACID 3: Embotellado desde barril (`bottleFromKeg`).
 * Actualiza atómicamente `bottles`, `kegs` e `inventory` (envases/insumos).
 */
export async function txBottleFromKeg(params: {
  bottles: BottleStock[];
  kegs: Keg[];
  inventory: Ingredient[];
  kegId: string;
  bottleStockId: string;
  lotCode?: string;
  previousKegVolume: number;
  newKegVolume: number;
  bottlesCreated: number;
}): Promise<boolean> {
  return dbCommitTransaction(
    {
      bottles: params.bottles,
      kegs: params.kegs,
      inventory: params.inventory,
    },
    {
      operation: 'BOTTLE_FROM_KEG',
      entityId: params.bottleStockId,
      lotCode: params.lotCode,
      description: `Trasvase de barril #${params.kegId} a ${params.bottlesCreated} botellas`,
      deltas: [
        {
          collection: 'kegs',
          itemId: params.kegId,
          previousValue: params.previousKegVolume,
          newValue: params.newKegVolume,
          unit: 'L',
        },
        {
          collection: 'bottles',
          itemId: params.bottleStockId,
          previousValue: 0,
          newValue: params.bottlesCreated,
          unit: 'un',
        },
      ],
    }
  );
}

/**
 * Transacción ACID 4: Venta o consumo en Taproom / Pizarra (`serveFromTap` / `giftFromTap` / `addSale`).
 * Actualiza en una única transacción `'rw'` el volumen restante del barril (`kegs`),
 * el registro de venta o gasto (`sales` / `expenses`) y el saldo del cliente (`customers`).
 */
export async function txTaproomOrCommercialSale(params: {
  kegs?: Keg[];
  sales?: Sale[];
  expenses?: Expense[];
  customers?: Customer[];
  entityId: string;
  lotCode?: string;
  operation?: 'TAPROOM_SALE' | 'TAPROOM_GIFT';
  description: string;
  deltas: StockLedgerEntry['deltas'];
}): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (params.kegs !== undefined) payload.kegs = params.kegs;
  if (params.sales !== undefined) payload.sales = params.sales;
  if (params.expenses !== undefined) payload.expenses = params.expenses;
  if (params.customers !== undefined) payload.customers = params.customers;

  return dbCommitTransaction(payload, {
    operation: params.operation ?? 'TAPROOM_SALE',
    entityId: params.entityId,
    lotCode: params.lotCode,
    description: params.description,
    deltas: params.deltas,
  });
}

// ============================================================================
// 7. COLA DE ESCRITURA TRANSACCIONAL SERIALIZADA (DEBOUNCED BATCH COMMIT)
// ============================================================================

const dirtyBuffer = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let activeFlushPromise: Promise<void> = Promise.resolve();

/**
 * Ejecuta inmediatamente el volcado transaccional de todas las claves pendientes en `dirtyBuffer`
 * dentro de una única transacción `db.transaction('rw', ...)`.
 */
export async function flushPendingSaves(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (dirtyBuffer.size === 0) {
    return activeFlushPromise;
  }

  const snapshot: Record<string, unknown> = {};
  dirtyBuffer.forEach((value, key) => {
    snapshot[key] = value;
  });
  dirtyBuffer.clear();

  activeFlushPromise = activeFlushPromise
    .then(async () => {
      await dbCommitTransaction(snapshot);
    })
    .catch((err) => {
      reportDbException('flushPendingSaves', err, false);
    });

  return activeFlushPromise;
}

/**
 * Encola una o múltiples claves para ser persistidas atómicamente en una sola transacción `'rw'`
 * tras una ventana de coalescencia (default: 250ms), evitando condiciones de carrera entre timers.
 *
 * @param entries - Objeto con las colecciones modificadas `{ batches, inventory, ... }`.
 * @param debounceMs - Tiempo de agrupación en milisegundos (default: 250ms).
 */
export function scheduleTransactionalSave(
  entries: Record<string, unknown>,
  debounceMs: number = 250
): void {
  for (const [key, value] of Object.entries(entries)) {
    dirtyBuffer.set(key, value);
    memoryFallbackStore.set(key, value);
  }

  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingSaves();
  }, debounceMs);
}

// Asegurar volcado inmediato antes de cerrar la pestaña o app Electron
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (dirtyBuffer.size > 0) {
      void flushPendingSaves();
    }
  });
}

// ============================================================================
// 8. MIGRACIÓN IDEMPOTENTE DESDE LOCALSTORAGE → INDEXEDDB (ONE-TIME LOCK)
// ============================================================================

const LS_KEYS_MAP: Record<string, PersistedCollectionKey> = {
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

let migrationLockPromise: Promise<boolean> | null = null;

/**
 * Migra datos heredados de `localStorage` a IndexedDB dentro de una única transacción `'rw'`.
 * Posee un lock de promesa en memoria para garantizar ejecución única incluso bajo
 * montajes concurrentes de `React.StrictMode` (resuelve Hallazgo A005).
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  if (migrationLockPromise) {
    return migrationLockPromise;
  }

  migrationLockPromise = (async (): Promise<boolean> => {
    try {
      const ready = await ensureDbReady();
      if (!ready) return false;

      const migrationDone = await db.kvStore.get('_migration_v1');
      if (migrationDone?.value === true) {
        return false;
      }

      if (typeof localStorage === 'undefined') {
        return false;
      }

      const now = new Date().toISOString();
      const entries: KvRecord[] = [];

      for (const [lsKey, dbKey] of Object.entries(LS_KEYS_MAP)) {
        try {
          const raw = localStorage.getItem(lsKey);
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (parsed !== null && parsed !== undefined) {
              entries.push({
                key: dbKey,
                value: parsed,
                updatedAt: now,
                schemaVersion: CURRENT_DB_SCHEMA_VERSION,
              });
            }
          }
        } catch (e) {
          reportDbException(`migrateFromLocalStorage:parse(${lsKey})`, e, false);
        }
      }

      await db.transaction('rw', [db.kvStore, db.meta], async () => {
        if (entries.length > 0) {
          await db.kvStore.bulkPut(entries);
        }
        await db.kvStore.put({
          key: '_migration_v1',
          value: true,
          updatedAt: now,
          schemaVersion: CURRENT_DB_SCHEMA_VERSION,
        });
        if (db.meta) {
          await db.meta.put({
            key: 'migrated_from_localstorage',
            value: { count: entries.length, migratedAt: now },
            updatedAt: now,
          });
        }
      });

      return entries.length > 0;
    } catch (e) {
      reportDbException('migrateFromLocalStorage', e, false);
      return false;
    }
  })();

  return migrationLockPromise;
}

// ============================================================================
// 9. HOOK useDbState (COMPATIBILIDAD CON ESTADOS INDIVIDUALES)
// ============================================================================

/**
 * Hook que sincroniza un estado React con IndexedDB de forma asíncrona y transaccional.
 */
export function useDbState<T>(
  key: string,
  fallback: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;

    dbGet<T>(key, fallback).then((loaded) => {
      if (!cancelled) {
        setValue(loaded);
        setIsLoaded(true);
        requestAnimationFrame(() => {
          isInitialLoad.current = false;
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (isInitialLoad.current) return;

    if (pendingSave.current) clearTimeout(pendingSave.current);

    pendingSave.current = setTimeout(() => {
      void dbSet(key, value);
    }, 300);

    return () => {
      if (pendingSave.current) clearTimeout(pendingSave.current);
    };
  }, [key, value]);

  return [value, setValue, isLoaded];
}
