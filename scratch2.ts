import { newBatchSchema } from './lib/validations';

const run = () => {
    const res = newBatchSchema.safeParse({
        recipeId: '123',
        recipeName: 'Test',
        volumeKettle: 300,
        brewDate: undefined,
        lotCode: '123'
    });
    console.log("brewDate undef:", !res.success ? res.error.issues[0].message : "success");
    
    const res2 = newBatchSchema.safeParse({
        recipeId: undefined,
        recipeName: 'Test',
        volumeKettle: 300,
        brewDate: '2023-01-01',
        lotCode: '123'
    });
    console.log("recipeId undef:", !res2.success ? res2.error.issues[0].message : "success");
}

run();
