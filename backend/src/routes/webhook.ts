import { Router } from "express";
import {
  handleCancelPlan,
  handleCheckoutSessionCompleted,
  handleSubscriptionSessionCompleted,
  stripe,
} from "../lib";
import bodyParser from "body-parser";
import Stripe from "stripe";

export const routerWebhook = Router();

routerWebhook.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    }
    const signature = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      res.status(400).send(`Webhook Error:` + JSON.stringify(err, null, 2));
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionSessionCompleted(event);
          break;

        case "customer.subscription.deleted":
          await handleCancelPlan(event);
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.status(200).send("ok");
    } catch (error) {
      console.error("Webhook handler error:", error);
      return res.status(200).send("ok");
    }
  }
);
