import { z } from 'zod';

export const pointRequestBodySchema = z
  .object({
    pointType: z.enum(['biblioteca', 'libreria', 'corner_free']),
    name: z.string().min(2).max(120),
    address: z.string().max(200).optional(),
    city: z.string().max(80).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    contactPhone: z.string().max(30).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const hasAddress = Boolean(data.address?.trim());
    const hasGps =
      data.latitude != null &&
      data.longitude != null &&
      Number.isFinite(data.latitude) &&
      Number.isFinite(data.longitude);
    if (!hasAddress && !hasGps) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inserisci un indirizzo oppure le coordinate GPS',
        path: ['address'],
      });
    }
  });

export type PointRequestBody = z.infer<typeof pointRequestBodySchema>;

export function pointRequestToDb(data: PointRequestBody) {
  return {
    pointType: data.pointType,
    name: data.name.trim(),
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    contactPhone: data.contactPhone?.trim() || null,
    notes: data.notes?.trim() || null,
  };
}
