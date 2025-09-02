import Stripe from "stripe";
import { prismaDB } from "./prisma";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: "2025-08-27.basil",
});

export const getStripeCustomerByEmail = async (email: string) => {
  const custumers = await stripe.customers.list({ email });
  return custumers.data[0];
};

export const createStripeCustomer = async (data: {
  email: string;
  name?: string;
}) => {
  const custumer = await getStripeCustomerByEmail(data?.email);
  if (custumer) return custumer;

  return stripe.customers.create({
    email: data.email,
    name: data.name,
  });
};

export const generateCheckout = async (userId: string, email: string) => {
  try {
    const customer = await createStripeCustomer({
      email,
    });
    const session = await stripe.checkout.sessions.create({
      locale: "en",
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: userId,
      customer: customer.id,
      success_url: `${process.env.FRONTEND_URL}/subscription-completed`,
      cancel_url: `${process.env.FRONTEND_URL}/`,
      line_items: [
        {
          price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    return {
      url: session.url,
    };
  } catch (error) {
    console.log("Error generating checkout", error);
  }
};

export const handleCheckoutSessionCompleted = async (event: {
  data: { object: Stripe.Checkout.Session };
}) => {
  const idUser = event.data.object.client_reference_id as string;
  const stripeSubscriptionId = event.data.object.subscription as string;
  const stripeCustomerId = event.data.object.customer as string;
  const checkoutStatus = event.data.object.payment_status;

  if (checkoutStatus !== "paid") return;

  if (!idUser || !stripeSubscriptionId || !stripeCustomerId) {
    throw new Error(
      "idUser, stripeSubscriptionId, stripeCustomerId is required"
    );
  }

  const userExist = await prismaDB.user.findUnique({ where: { id: idUser } });

  if (!userExist) {
    throw new Error("user not found");
  }

  const subscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId
  );

  await prismaDB.user.update({
    where: {
      id: userExist.id,
    },
    data: {
      stripeCustomerId,
      stripeSubscriptionId,
      stripeSubscriptionStatus: subscription.status,
      isPremium:
        subscription.status === "active" || subscription.status === "trialing",
    },
  });
};

export const handleSubscriptionSessionCompleted = async (event: {
  data: { object: Stripe.Subscription };
}) => {
  const subscriptionStatus = event.data.object.status;
  const stripeCustomerId = event.data.object.customer as string;
  const userId = event.data.object.metadata?.userId;

  let userExist = null;

  if (userId) {
    userExist = await prismaDB.user.findUnique({
      where: { id: userId },
    });
  } else {
    userExist = await prismaDB.user.findFirst({
      where: { stripeCustomerId },
    });
  }

  if (!userExist) return;

  await prismaDB.user.update({
    where: {
      id: userExist.id,
    },
    data: {
      stripeSubscriptionStatus: subscriptionStatus,
    },
  });
};

export const handleCancelPlan = async (event: {
  data: { object: Stripe.Subscription };
}) => {
  const stripeCustomerId = event.data.object.customer as string;

  const userExist = await prismaDB.user.findFirst({
    where: {
      stripeCustomerId,
    },
  });

  if (!userExist) return;

  await prismaDB.user.update({
    where: {
      id: userExist.id,
    },
    data: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      isPremium: false,
      currentPeriodEndAt: null,
    },
  });
};

export const handleCancelSubscription = async (userId: string) => {
  const userExist = await prismaDB.user.findUnique({ where: { id: userId } });

  if (!userExist?.stripeSubscriptionId) {
    throw new Error("User not found");
  }

  await prismaDB.user.update({
    where: {
      id: userId,
    },
    data: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
      isPremium: false,
      currentPeriodEndAt: null,
    },
  });

  const subscription = await stripe.subscriptions.update(
    userExist.stripeSubscriptionId,
    {
      cancel_at_period_end: true,
    }
  );
};

export const generateBillingPortal = async (customerId: string) => {
  const session = await stripe.billingPortal.sessions.create({
    locale: "en",
    customer: customerId,
    return_url: process.env.FRONTEND_URL,
  });
  return { url: session.url };
};

export const getPaymentHistory = async (customerId: string) => {
  const payments = await stripe.paymentIntents.list({
    customer: customerId,
    limit: 10,
  });
  return payments.data;
};

//TODO Tratar idempotência com o prisma, mas poderia usar o REDIS também
// const eventExist = await prismaDB.stripeEvent.findUnique({
//   where: { id: event.id },
// });
// if (eventExist) {
//   return res.send(); // já processado
// }

// await prismaDB.stripeEvent.create({
//   data: { id: event.id, type: event.type },
// });
