import { describe, it, expect } from 'vitest';
import { calculateEfficiencyData, groupSalesHistory } from '../../lib/selectors';
import { parseVolumeFromFormat } from '../../lib/volumeParser';
import { Batch, BatchStatus, Sale } from '../../types';

describe('Selectors and Calculations', () => {
  describe('parseVolumeFromFormat', () => {
    it('should correctly parse volume from common formats', () => {
      expect(parseVolumeFromFormat('Barril 50L')).toBe(50);
      expect(parseVolumeFromFormat('Botella 500ml')).toBe(0.5);
      expect(parseVolumeFromFormat('Lata 473 ml')).toBe(0.473);
      expect(parseVolumeFromFormat('Barril 20 L')).toBe(20);
      expect(parseVolumeFromFormat('Media Pinta')).toBe(0.33);
      expect(parseVolumeFromFormat('Pinta')).toBe(0.5);
      expect(parseVolumeFromFormat('Litro')).toBe(1.0);
    });

    it('should return 0 for unknown or invalid formats', () => {
      expect(parseVolumeFromFormat('Barril')).toBe(20);
      expect(parseVolumeFromFormat('Caja de cervezas')).toBe(0);
      expect(parseVolumeFromFormat('')).toBe(0);
    });
  });

  describe('calculateEfficiencyData', () => {
    it('should calculate efficiency correctly for completed batches', () => {
      const mockBatches: Batch[] = [
        {
          id: '1',
          lotCode: 'L001',
          recipeId: 'r1',
          recipeName: 'IPA',
          style: 'IPA',
          status: BatchStatus.COMPLETED,
          brewDate: '2023-10-01',
          volumeKettle: 100,
          volumeFermenter: 90,
          volumePackaged: 85,
          originalGravity: 1.050, // actualPoints: 90 * (1.050 - 1) * 1000 = 4500
          finalGravity: 1.010,
          ingredientsUsed: [
            { inventoryId: 'i1', type: 'MALT', name: 'Malta Pilsen', amountUsed: 20, costAtTime: 1, unit: 'kg' } // potentialPoints: 20 * 300 = 6000
          ],
          totalIngredientsCost: 20,
          overheadCost: 10,
          fermentationLogs: [],
          notes: ''
        }
      ];

      const data = calculateEfficiencyData(mockBatches);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('L001');
      // 4500 / 6000 = 0.75 -> 75.0%
      expect(data[0].eficiencia).toBe(75.0);
    });

    it('should handle planned batches correctly (ignore them)', () => {
      const mockBatches: Batch[] = [
        {
          id: '2',
          lotCode: 'L002',
          recipeId: 'r2',
          recipeName: 'Stout',
          style: 'Stout',
          status: BatchStatus.PLANNED,
          brewDate: '2023-10-05',
          volumeKettle: 100,
          volumeFermenter: 0,
          volumePackaged: 0,
          originalGravity: 0,
          finalGravity: 0,
          ingredientsUsed: [],
          totalIngredientsCost: 0,
          overheadCost: 0,
          fermentationLogs: [],
          notes: ''
        }
      ];
      
      const data = calculateEfficiencyData(mockBatches);
      expect(data).toHaveLength(0);
    });
  });

  describe('groupSalesHistory', () => {
    it('should group sales by month correctly', () => {
      const mockSales: Sale[] = [
        {
          id: 's1',
          customerId: 'c1',
          type: 'KEG',
          amount: 5000,
          date: '2023-10-15T10:00:00Z',
          quantity: 2,
          format: 'Barril 50L',
          description: '',
          isPaid: true
        },
        {
          id: 's2',
          customerId: 'c2',
          type: 'BOTTLE',
          amount: 1500,
          date: '2023-10-20T10:00:00Z',
          quantity: 10,
          format: 'Botella 500ml',
          description: '',
          isPaid: true
        }
      ];

      const grouped = groupSalesHistory(mockSales);
      expect(grouped['2023-10']).toBeDefined();
      expect(grouped['2023-10'].totalRevenue).toBe(6500);
      expect(grouped['2023-10'].totalItems).toBe(12);
      expect(grouped['2023-10'].totalVolume).toBe(105); // 2 * 50 + 10 * 0.5 = 100 + 5 = 105
      expect(grouped['2023-10'].breakdown['Barril 50L'].quantity).toBe(2);
      expect(grouped['2023-10'].breakdown['Botella 500ml'].quantity).toBe(10);
    });

    it('should group TAPROOM sales correctly and classify them under draft/taproom format', () => {
      const mockSales: Sale[] = [
        {
          id: 's3',
          type: 'TAPROOM',
          amount: 3000,
          date: '2023-10-15T12:00:00Z',
          quantity: 1,
          format: 'Pinta',
          description: 'Venta Pizarra: Pinta - Barril #K-101',
          isPaid: true
        }
      ];

      const grouped = groupSalesHistory(mockSales);
      expect(grouped['2023-10']).toBeDefined();
      expect(grouped['2023-10'].totalRevenue).toBe(3000);
      expect(grouped['2023-10'].totalItems).toBe(1);
      expect(grouped['2023-10'].breakdown['Pinta']).toBeDefined();
      expect(grouped['2023-10'].breakdown['Pinta'].type).toBe('TAPROOM');
      expect(grouped['2023-10'].breakdown['Pinta'].quantity).toBe(1);
    });
  });
});
