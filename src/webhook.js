import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe requires raw body for webhooks
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const customerEmail = session.customer_email;
      const planName = session.metadata?.plan || "Pro"; // You can pass this in Stripe metadata

      // 👉 Store this in your DB (pseudo code below)
      console.log(`✅ Stripe payment complete: ${customerEmail} → ${planName}`);

      // TODO: Replace with actual DB call
      // await db.users.update({ email: customerEmail }, { plan: planName });

      // Optionally notify frontend via webhook event queue or email
    }

    res.json({ received: true });
  }
);

// Health check
app.get("/", (req, res) => {
  res.send("🔁 Stripe webhook is running.");
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Webhook server listening on port ${PORT}`));
