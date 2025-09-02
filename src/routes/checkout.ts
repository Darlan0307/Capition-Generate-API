import { Router } from "express";
import {
  generateBillingPortal,
  generateCheckout,
  getPaymentHistory,
  handleCancelSubscription,
} from "../lib";

export const routerCheckout = Router();

routerCheckout.post("/checkout-session", async (req, res) => {
  try {
    if (!req.user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const checkout = await generateCheckout(req.user.id, req.user.email);

    res.status(200).json({ checkout });
  } catch (error) {
    res.status(500).json({ message: "Error generating checkout page" });
  }
});

routerCheckout.post("/billing-portal", async (req, res) => {
  try {
    if (!req.user?.stripeCustomerId) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const portal = await generateBillingPortal(req.user.stripeCustomerId);
    res.status(200).json({ url: portal.url });
  } catch (error) {
    res.status(500).json({ message: "Error generating billing portal" });
  }
});

routerCheckout.delete("/cancel-subscription", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(404).json({ message: "Subscription not found" });
    }
    await handleCancelSubscription(req.user.id);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Error generating billing portal" });
  }
});

routerCheckout.get("/payment-history", async (req, res) => {
  try {
    if (!req.user?.stripeCustomerId) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const history = await getPaymentHistory(req.user.stripeCustomerId);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Error getting payment history" });
  }
});
