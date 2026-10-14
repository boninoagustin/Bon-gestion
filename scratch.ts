import { newBatchSchema } from './lib/validations';
import { z } from 'zod';

const result = newBatchSchema.safeParse({
    recipeId: '123',
    recipeName: 'Test',
    volumeKettle: 300,
    brewDate: '2023-01-01',
    lotCode: 'LOTE-1'
});

console.log(result.success ? "Success" : result.error.issues);
