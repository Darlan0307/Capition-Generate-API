import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

export type PrismaOrTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function withIdempotency<T>(
  tx: PrismaClient | PrismaOrTransaction,
  event: { id: string; type: Stripe.Event.Type },
  handler: () => Promise<T>
): Promise<T | void> {
  const exists = await tx.stripeEvent.findUnique({ where: { id: event.id } });
  if (exists) return;

  const result = await handler();

  await tx.stripeEvent.create({
    data: { id: event.id, type: event.type },
  });

  return result;
}
