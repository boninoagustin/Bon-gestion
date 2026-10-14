const { z } = require('zod');
const schema = z.object({ brewDate: z.string().min(1, "Mensaje") });
const result = schema.safeParse({});
console.log(result.error.issues[0].message);
