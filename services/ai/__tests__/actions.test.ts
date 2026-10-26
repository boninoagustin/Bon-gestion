import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../context/db', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn(),
  scheduleTransactionalSave: vi.fn(),
}));
import { useBreweryStore as store } from '../../../context/store';
import { aiActions, buildAppSummary } from '../actions';
import { executeTool } from '../tools';
import { BatchStatus } from '../../../types';
const tank = (id: string, name: string) => ({ id, name, capacity: 200, status: 'DIRTY' as const });
beforeEach(() => { store.setState({ fermenters: [tank('uuid-a', 'F-01')], batches: [] }); });
it.each(['F-01', 'Fermentador 1', '1'])('resuelve alias %s sin inventar', q => {
  expect(executeTool('clean_fermenter', { fermenterId: q }).success).toBe(true);
});
it('no confunde tanque 1 con 10', () => {
  store.setState({ fermenters: [tank('uuid-z', 'F-10')] });
  expect(executeTool('clean_fermenter', { fermenterId: '1' }).error).toBeTruthy();
});
const batch = (id = 'b1') => ({ id, lotCode: id, recipeName: 'IPA', status: BatchStatus.FERMENTING, fermenterId: 'uuid-a', fermentationLogs: [
  { id: 'recent', date: '2026-10-02', action: 'MEDICION', temperature: 0, gravity: 1.01 },
  { id: 'old', date: '2026-10-01', action: 'MEDICION', temperature: 18, gravity: 1.05 },
  { id: 'event', date: '2026-10-03', action: 'PURGA' },
] } as any);
it('lecturas usan última medición por fecha e incluyen cero', () => {
  store.setState({ batches: [batch()] });
  expect(aiActions.getBatchDetails({ lotCode: 'b1' }).batch).toMatchObject({ lastTemperatureReading: 0, lastGravityReading: 1.01 });
  expect(aiActions.getFermentersStatus().fermenters[0].currentBatch).toMatchObject({ lastTemperature: 0, lastGravity: 1.01 });
  expect(buildAppSummary()).toContain('Temp:0°C');
});
it('lookup prefiere currentBatchId y fallback excluye terminados', () => {
  const old = { ...batch('old'), status: BatchStatus.COMPLETED };
  store.setState({ batches: [old, batch('fallback'), batch('current')], fermenters: [{ ...tank('uuid-a', 'F-01'), status: 'OCCUPIED', currentBatchId: 'current' }] });
  expect(aiActions.getFermentersStatus().fermenters[0].currentBatch.id).toBe('current');
  expect(aiActions.getDailyBriefing().occupiedFermenters[0].batch.lotCode).toBe('current');
  store.setState({ batches: [old, batch('fallback')], fermenters: [{ ...tank('uuid-a', 'F-01'), status: 'OCCUPIED' }] });
  expect(aiActions.getFermentersStatus().fermenters[0].currentBatch.id).toBe('fallback');
  store.setState({ batches: [old] });
  expect(aiActions.getFermentersStatus().fermenters[0].currentBatch).toBeNull();
});
it('undo de reasignación restaura lote y ambos tanques exactos', () => {
  const batches = [{ ...batch(), fermenterName: 'Origen', volumeFermenter: 100, volumeKettle: 100 }];
  const fermenters = [{ ...tank('uuid-a', 'Origen'), status: 'OCCUPIED' as const, currentBatchId: 'b1', notes: 'origen' }, { ...tank('dest', 'Destino'), status: 'AVAILABLE' as const, notes: 'destino' }];
  store.setState({ batches, fermenters });
  expect(executeTool('assign_fermenter', { fermenterId: 'Destino', lotCode: 'b1' }).success).toBe(true);
  expect(executeTool('undo_last_action', {}).success).toBe(true);
  expect(store.getState().batches).toEqual(batches);
  expect(store.getState().fermenters).toEqual(fermenters);
});
it('rechaza alias numérico ambiguo', () => {
  store.setState({ fermenters: [tank('uuid-a', 'F-01'), tank('uuid-b', 'Fermentador 1')] });
  expect(executeTool('clean_fermenter', { fermenterId: '1' }).error).toMatch(/coincidencias/);
});
