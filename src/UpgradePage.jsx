import React from "react";
import "./App.css";

function UpgradePage() {
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h1 style={{ fontSize: "2.2rem", color: "#ffd700", marginBottom: 10 }}>
        Upgrade to Unlock Full Power
      </h1>
      <p style={{ color: "#ccc", marginBottom: 40 }}>
        Get more coins, skip limits, and VIP features
      </p>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 30
      }}>
        {plans.map(plan => (
          <div key={plan.title} style={{
            background: "#1c1c1c",
            padding: 24,
            borderRadius: 16,
            width: 260,
            boxShadow: "0 0 20px rgba(0,0,0,0.3)",
            border: "2px solid #444"
          }}>
            <h2 style={{ fontSize: "1.4rem", color: "#fff" }}>{plan.emoji} {plan.title}</h2>
            <p style={{ color: plan.price === "Free forever" ? "#ffd700" : "#ffcc70", fontSize: "1.1rem", margin: "10px 0" }}>
              {plan.price}
            </p>
            <ul style={{ listStyle: "none", padding: 0, textAlign: "left", color: "#ccc" }}>
              {plan.features.map((f, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{f}</li>
              ))}
            </ul>
            {plan.link && (
              <a href={plan.link} target="_blank" rel="noreferrer">
                <button style={{
                  background: "#ffd700",
                  color: "#000",
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: 10,
                  marginTop: 14,
                  cursor: "pointer",
                  fontWeight: "bold"
                }}>
                  Buy Now
                </button>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const plans = [
  {
    emoji: "🆓",
    title: "Starter",
    price: "Free forever",
    features: ["🎭 Random connect", "⏩ Limited skip", "❌ No filters"]
  },
  {
    emoji: "💼",
    title: "Starter Pack",
    price: "$1.99",
    features: ["🪙 5 Coins", "⚡ Instant connect"],
    link: "https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03"
  },
  {
    emoji: "🚀",
    title: "Pro Pack",
    price: "$5.00",
    features: ["🪙 20 Coins", "🚀 Faster match"],
    link: "https://buy.stripe.com/aFa7sL91X83y17bfNM97G04"
  },
  {
    emoji: "🔥",
    title: "Power Pack",
    price: "$9.99",
    features: ["🪙 50 Coins", "🎁 Bonus Gifts"],
    link: "https://buy.stripe.com/14AfZh0vrbfK3fj8lk97G05"
  },
  {
    emoji: "👑",
    title: "VIP Access",
    price: "$19.99",
    features: ["✅ Unlimited calls", "🌍 All filters unlocked"],
    link: "https://buy.stripe.com/dRm3cvemh4Rm9DH9po97G06"
  }
];

export default UpgradePage;
