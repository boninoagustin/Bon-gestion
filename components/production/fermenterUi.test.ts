import { describe, it, expect } from 'vitest';
import * as ui from './fermenterUi';
import { BatchStatus, Batch, Fermenter } from '../../types';
const tank = { id: 't', name: 'T', capacity: 100, status: 'AVAILABLE' } as Fermenter;
const batch = { id: 'b', status: BatchStatus.MASHING, volumeKettle: 100, volumeFermenter: 0 } as Batch;
describe('fermenter UI validation', () => {
 it('reports store errors without closing or escaping the handler', () => {
  let closed = false; let message = '';
  expect(ui.runFormAction(() => { throw new Error('Capacidad excedida'); }, text => { message = text; }, () => { closed = true; })).toBe(false);
  expect(message).toBe('Capacidad excedida'); expect(closed).toBe(false);
  expect(ui.runFormAction(() => {}, text => { message = text; }, () => { closed = true; })).toBe(true);
  expect(closed).toBe(true);
 });
 it('prevents changing occupied status and shrinking below contents', () => {
  const occupied = {...tank, status: 'OCCUPIED' as const, currentBatchId: 'b'};
  expect(ui.tankEditError(occupied, 'AVAILABLE', 100, [batch])).toMatch(/desocupar/i);
  expect(ui.tankEditError(occupied, 'OCCUPIED', 99, [batch])).toMatch(/capacidad/i);
  expect(ui.tankEditError(undefined, 'OCCUPIED', 100, [])).toMatch(/asignar/i);
  expect(ui.tankEditError(undefined, 'AVAILABLE', 0, [])).toMatch(/capacidad/i);
 });
 it('reports actual overflow rather than clipping the percentage', () => {
  expect(ui.tankFill({...batch, volumeFermenter: 125}, tank)).toEqual({volume: 125, percent: 125, excess: 25});
 });
 it('excludes terminal, oversized and unavailable assignments', () => {
  expect(ui.assignmentError(tank, batch)).toBe('');
  for (const status of [BatchStatus.PACKAGED, BatchStatus.COMPLETED]) expect(ui.assignmentError(tank, {...batch, status})).toMatch(/finalizado/i);
  expect(ui.assignmentError(tank, {...batch, volumeKettle: 101})).toMatch(/capacidad/i);
  expect(ui.assignmentError({...tank, status: 'DIRTY'}, batch)).toMatch(/disponible/i);
  expect(ui.assignmentError({...tank, status: 'OCCUPIED', currentBatchId: 'b'}, {...batch, fermenterId: 't'})).toBe('');
  expect(ui.assignmentError({...tank, currentBatchId: 'other'}, batch)).toMatch(/disponible/i);
 });
});
