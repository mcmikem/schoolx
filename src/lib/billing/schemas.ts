import { z } from "zod";

export const cycleSchema = z.enum(["term", "annual"]).default("term");

export const quoteBodySchema = z.object({
  action: z.enum(["renew", "upgrade", "module"]),
  plan: z.string().optional(),
  cycle: cycleSchema.optional(),
  moduleKeys: z.array(z.string()).optional(),
  promoCode: z.string().nullable().optional(),
});

export const manualPaymentBodySchema = z.object({
  // School submission
  method: z.enum(["cash", "bank"]).optional(),
  reference: z.string().min(3).optional(),
  note: z.string().optional(),
  action: z.enum(["renew", "upgrade", "module"]).optional(),
  plan: z.string().optional(),
  cycle: cycleSchema.optional(),
  moduleKeys: z.array(z.string()).optional(),
  promoCode: z.string().nullable().optional(),
  // Super-admin decision
  paymentId: z.string().uuid().optional(),
  decision: z.enum(["confirm", "reject"]).optional(),
  reason: z.string().optional(),
  schoolId: z.string().uuid().optional(),
});

export const changePlanBodySchema = z.object({
  action: z.enum(["schedule-downgrade", "cancel-scheduled", "status"]),
  plan: z.string().optional(),
  schoolId: z.string().uuid().optional(),
});

export const mobileMoneyBodySchema = z.object({
  provider: z.enum(["mtn", "airtel"]),
  plan: z.string().min(1),
  phoneNumber: z.string().min(9),
  promoCode: z.string().nullable().optional(),
});

export const moduleCheckoutBodySchema = z.object({
  provider: z.enum(["mtn", "airtel", "paypal", "manual"]),
  moduleKeys: z
    .array(z.string().trim().min(1).max(64))
    .min(1)
    .max(21)
    .refine((keys) => new Set(keys).size === keys.length),
  promoCode: z.string().trim().max(64).nullable().optional(),
  phoneNumber: z.string().trim().min(9).max(20).optional(),
  method: z.enum(["cash", "bank"]).optional(),
  reference: z.string().trim().min(3).max(100).optional(),
});
