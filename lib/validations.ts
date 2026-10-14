import { z } from 'zod';
import { EventType } from '../types';

export const newBatchSchema = z.object({
  recipeId: z.string({ message: "Debes seleccionar una receta maestra" }).min(1, "Debes seleccionar una receta maestra"),
  recipeName: z.string({ message: "El nombre de la receta es requerido" }).min(1, "El nombre de la receta es requerido"),
  volumeKettle: z.number({ message: "El volumen de olla debe ser un número válido" }).positive("El volumen de olla debe ser mayor a 0"),
  brewDate: z.string({ message: "La fecha de cocción es requerida" }).min(1, "La fecha de cocción es requerida"),
  lotCode: z.string({ message: "El código de lote es requerido" }).min(1, "El código de lote es requerido")
});

export const kegUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(['CLEAN', 'DIRTY', 'FULL', 'WITH_CLIENT']),
  currentVolume: z.number().min(0, "El volumen no puede ser negativo"),
  contents: z.string().optional(),
});

export const recipeSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  style: z.string().min(1, "El estilo es requerido"),
  baseVolume: z.number().positive("El volumen base debe ser mayor a 0"),
  targetOG: z.number().positive("La gravedad original debe ser mayor a 0"),
  targetFG: z.number().positive("La gravedad final debe ser mayor a 0"),
});

export const calendarEventSchema = z.object({
  id: z.string().optional(),
  batchId: z.string().optional(),
  title: z.string().min(1, "El título es requerido"),
  date: z.string().min(1, "La fecha es requerida"),
  type: z.nativeEnum(EventType),
  completed: z.boolean().default(false),
  notes: z.string().optional(),
});
