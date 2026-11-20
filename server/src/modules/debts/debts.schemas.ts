import { z } from 'zod';

/** Explicit enum parsing: z.coerce.boolean() would turn the string "false" into true. */
export const listDebtsQuerySchema = z.object({
  activeOnly: z
    .enum(['true', 'false'], { error: 'activeOnly harus berupa true atau false.' })
    .transform((value) => value === 'true')
    .optional(),
});

export type ListDebtsQuery = z.infer<typeof listDebtsQuerySchema>;
