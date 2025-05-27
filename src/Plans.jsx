import React from "react";

function Plans() {
  const currentPlan = localStorage.getItem("droxion_plan") || "Starter";
  const starterUsage = parseInt(localStorage.getItem("starter_usage") || "0", 10);

  const plans = [
    {
      name: "Starter",
      price: "$0",
      description: "For creators testing the waters.",
      features: [
        "5 AI reels / month",
        "Basic templates",
        "Standard voice",
        `${starterUsage}/5 videos used`,
      ],
      color: "bg-gray-900",
      badge: "Free",
      link: "starter",
    },
    {
      name: "Pro",
      price: "$19/mo",
      description: "Perfect for solo creators & influencers.",
      features: [
        "Unlimited reels",
        "Premium templates",
        "Multi-language voices",
        "Priority support",
      ],
      color: "bg-blue-900",
      badge: "Popular",
      link: "https://buy.stripe.com/test_3cI4gz7YN4sR1oGfo77ss01",
    },
    {
      name: "Business",
      price: "$49/mo",
      description: "For brands, teams, and agencies.",
      features: [
        "Unlimited team reels",
        "Custom branding",
        "Upload editor",
        "Analytics & API access",
      ],
      color: "bg-yellow-700",
      badge: "Best Value",
      link: "https://buy.stripe.com/test_9B6aEX5QF4sRgjA0td7ss02",
    },
  ];

  const handleClick = (plan) => {
    if (plan.link === "starter") {
      localStorage.setItem("droxion_plan", "Starter");
      alert("✅ You're now on the free Starter plan.");
    } else {
      localStorage.setItem("droxion_plan", plan.name);
      window.open(plan.link, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-4 py-8">
      <h1 className="text-4xl font-bold text-green-400 mb-10 text-center">💳 Choose Your Plan</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`${plan.color} rounded-2xl shadow-lg p-6 border border-gray-700 relative transition hover:scale-[1.01]`}
          >
            <span className="absolute top-4 right-4 bg-white text-black text-xs font-bold px-2 py-1 rounded-full shadow">
              {plan.badge}
            </span>

            <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>
            <p className="text-3xl font-bold mb-2">{plan.price}</p>
            <p className="text-sm text-gray-300 mb-5">{plan.description}</p>

            <ul className="text-sm space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i}>✅ {f}</li>
              ))}
            </ul>

            <button
              onClick={() => handleClick(plan)}
              className="w-full bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              {plan.name === "Starter" ? "Get Started" : "Upgrade"}
            </button>

            {currentPlan === plan.name && (
              <div className="mt-4 text-xs bg-green-700 text-white px-3 py-1 rounded-full text-center">
                ✅ You’re on this plan
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Plans;
