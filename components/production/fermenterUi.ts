import { Batch, BatchStatus, Fermenter, FermenterStatus } from '../../types';

export function assignmentError(tank: Fermenter | undefined, batch: Pick<Batch, 'status' | 'volumeFermenter' | 'volumeKettle'> & Partial<Pick<Batch, 'id' | 'fermenterId'>>): string {
    if (!tank) return 'El fermentador ya no existe.';
    if (batch.status === BatchStatus.PACKAGED || batch.status === BatchStatus.COMPLETED) return 'No se puede asignar un lote finalizado.';
    const current = !!batch.id && tank.currentBatchId === batch.id && batch.fermenterId === tank.id;
    if (!current && (tank.status !== 'AVAILABLE' || tank.currentBatchId)) return 'El fermentador no está disponible.';
    const volume = batch.volumeFermenter > 0 ? batch.volumeFermenter : batch.volumeKettle;
    if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(batch.volumeFermenter) || batch.volumeFermenter < 0) return 'El volumen debe ser válido y mayor a cero.';
    if (!Number.isFinite(tank.capacity) || tank.capacity <= 0 || volume > tank.capacity) return `El volumen (${volume} L) supera la capacidad de ${tank.name} (${tank.capacity} L).`;
    return '';
}

export function runFormAction(action: () => void, report: (message: string) => void, success?: () => void): boolean {
    try { action(); } catch (error) {
        report(error instanceof Error ? error.message : 'No se pudo guardar. Revisa los datos e intenta nuevamente.');
        return false;
    }
    success?.();
    return true;
}

export function tankFill(batch: Pick<Batch, 'volumeFermenter' | 'volumeKettle'>, tank: Fermenter) {
    const volume = batch.volumeFermenter > 0 ? batch.volumeFermenter : batch.volumeKettle;
    return { volume, percent: tank.capacity > 0 ? Math.round(volume / tank.capacity * 100) : 0, excess: Math.max(0, volume - tank.capacity) };
}

export function tankEditError(tank: Fermenter | undefined, status: FermenterStatus, capacity: number, batches: Batch[]): string {
    if (!Number.isFinite(capacity) || capacity <= 0) return 'La capacidad debe ser mayor a cero.';
    const linked = tank ? batches.filter(b => b.id === tank.currentBatchId || b.fermenterId === tank.id) : [];
    const occupied = tank?.status === 'OCCUPIED' || !!tank?.currentBatchId || linked.length > 0;
    if (occupied && status !== tank?.status) return 'Debes desocupar el tanque antes de cambiar su estado.';
    if (!occupied && status === 'OCCUPIED') return 'Usa Asignar a Lote para ocupar el tanque.';
    if (linked.some(b => tankFill(b, {...tank!, capacity}).excess > 0)) return 'La capacidad no puede ser menor al volumen del lote asignado.';
    return '';
}
