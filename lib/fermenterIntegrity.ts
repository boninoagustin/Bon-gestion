import { BatchStatus, type Batch, type Fermenter } from '../types';

export const isFinishedBatch = (batch: Batch) => batch.status === BatchStatus.PACKAGED || batch.status === BatchStatus.COMPLETED;

/** Shared by batch creation, editing and explicit assignment. Existing reciprocal
 * assignments may stay occupied; new assignments require a clean AVAILABLE tank. */
export function validateFermenterAssignment(batch: Batch, id: string, batches: Batch[], fermenters: Fermenter[]): Fermenter {
  const tank = fermenters.find(f => f.id === id);
  if (!tank) throw new Error('El fermentador no existe.');
  if (isFinishedBatch(batch)) throw new Error('No se puede asignar un lote finalizado o completado.');
  const same = tank.currentBatchId === batch.id && batch.fermenterId === id;
  if ((tank.status !== 'AVAILABLE' && !(same && tank.status === 'OCCUPIED')) || (tank.currentBatchId && !same) || batches.some(b => b.id !== batch.id && b.fermenterId === id && !isFinishedBatch(b))) {
    throw new Error('El fermentador debe estar disponible, limpio y sin otro lote.');
  }
  if (!Number.isFinite(batch.volumeKettle) || batch.volumeKettle < 0 || !Number.isFinite(tank.capacity) || tank.capacity <= 0 || batch.volumeKettle > tank.capacity) {
    throw new Error('La capacidad del fermentador es insuficiente o el volumen es inválido.');
  }
  return tank;
}
