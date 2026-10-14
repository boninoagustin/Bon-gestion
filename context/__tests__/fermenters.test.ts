import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('../db', () => ({ dbGet: vi.fn(async (_key, fallback) => fallback), dbSet: vi.fn(async () => {}) }));
import { useBreweryStore as store } from '../store';
import { BatchStatus, type Batch, type Fermenter } from '../../types';
import { dbSet } from '../db';
const batch = (overrides: Partial<Batch> = {}): Batch => ({ id: 'b1', recipeName: 'Ale', brewDate: '2026-01-01', status: BatchStatus.FERMENTING, volumeKettle: 100, volumePackaged: 90, ingredientsUsed: [], ...overrides } as Batch);
const tank = (overrides: Partial<Fermenter> = {}): Fermenter => ({ id: 'f1', name: 'Tank', capacity: 150, status: 'AVAILABLE', ...overrides });
const occupied = () => store.setState({ batches: [batch({ fermenterId: 'f1', fermenterName: 'Tank' })], fermenters: [tank({ status: 'OCCUPIED', currentBatchId: 'b1' })] });
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); store.setState({ batches: [], fermenters: [], inventory: [], kegs: [], calendarEvents: [] }); });
afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); });
describe('fermenter integrity', () => {
  it('generates unique ids and rejects explicit duplicate ids and identity edits', () => {
    const { id, ...input } = tank();
    for (let i = 0; i < 100; i++) store.getState().addFermenter(input);
    expect(new Set(store.getState().fermenters.map(f => f.id)).size).toBe(100);
    expect(() => store.getState().addFermenter(store.getState().fermenters[0])).toThrow(Error);
    store.getState().addBatch(batch());
    expect(() => store.getState().addBatch(batch())).toThrow(Error);
    expect(() => store.getState().updateBatch('b1', { id: 'other' })).toThrow(Error);
  });
  it('rejects creating an occupied fermenter without reciprocal assignment', () => {
    expect(() => store.getState().addFermenter(tank({ status: 'OCCUPIED', currentBatchId: 'b1' }))).toThrow(Error);
  });
  it.each(['clean', 'status', 'dirty', 'unlink'])('rejects unsafe occupied tank mutation %s', action => {
    occupied(); const s = store.getState();
    expect(() => action === 'clean' ? s.cleanFermenter('f1') : action === 'dirty' ? s.markFermenterDirty('f1') : s.updateFermenter('f1', action === 'status' ? { status: 'AVAILABLE' } : { currentBatchId: undefined })).toThrow(Error);
    expect(store.getState()).toBe(s);
  });
  it('renames reciprocal batch cache and validates capacity edits', () => {
    occupied(); store.getState().updateFermenter('f1', { name: 'Renamed' });
    expect(store.getState().batches[0].fermenterName).toBe('Renamed');
    expect(() => store.getState().updateFermenter('f1', { capacity: 1 })).toThrow(Error);
  });
  it.each(['assign', 'add', 'edit'])('validates assignment via %s atomically', route => {
    for (const [f, b] of [
      [tank({ status: 'DIRTY' }), batch()], [tank({ status: 'MAINTENANCE' }), batch()],
      [tank({ status: 'OCCUPIED', currentBatchId: 'other' }), batch()],
      [tank({ capacity: 50 }), batch()], [tank(), batch({ status: BatchStatus.PACKAGED })],
      [tank(), batch({ status: BatchStatus.COMPLETED })],
    ] as [Fermenter, Batch][]) {
      store.setState({ fermenters: [f], batches: route === 'add' ? [] : [b] });
      const before = store.getState();
      expect(() => route === 'assign' ? before.assignBatchToFermenter('f1', b.id) : route === 'add' ? before.addBatch({ ...b, fermenterId: 'f1' }) : before.updateBatch(b.id, { fermenterId: 'f1' })).toThrow(Error);
      expect(store.getState()).toBe(before);
    }
  });
  it.each(['delete', 'finish', 'keg'])('historical %s cannot free another batch tank', action => {
    occupied(); store.setState({ batches: [batch({ id: 'old', status: BatchStatus.PACKAGED, fermenterId: 'f1', volumeAvailable: 10 }), ...store.getState().batches], kegs: [{ id: 'k1', size: 10 } as any] });
    if (action === 'delete') store.getState().deleteBatch('old');
    if (action === 'finish') store.getState().updateBatch('old', { status: BatchStatus.COMPLETED });
    if (action === 'keg') store.getState().fillKegFromBatch('k1', 'old');
    expect(store.getState().fermenters[0]).toMatchObject({ status: 'OCCUPIED', currentBatchId: 'b1' });
    if (action !== 'delete') expect(store.getState().batches[0].fermenterId).toBeUndefined();
  });
  it.each([BatchStatus.PACKAGED, BatchStatus.COMPLETED])('releases both sides when %s even with positive volume', status => {
    occupied(); store.getState().updateBatch('b1', { status, volumeAvailable: 90 });
    expect(store.getState().fermenters[0]).toMatchObject({ status: 'DIRTY', currentBatchId: undefined });
    expect(store.getState().batches[0]).toMatchObject({ fermenterId: undefined, fermenterName: undefined });
  });
});
