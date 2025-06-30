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
        "🪙 50 coins",
      ],
      color: "bg-gradient-to-br from-gray-800 to-gray-900",
      badge: "Free",
      link: "starter",
    },
    {
      name: "Pro",
      price: "$1.99/mo",
      description: "Unlock full access to AI Chat, Images, Coding & Video Tools.",
      features: [
        "Unlimited AI tools",
        "Image generator unlocked",
        "Video & chat assistant",
        "Smart YouTube analysis",
        "🪙 All features included",
      ],
      color: "bg-gradient-to-br from-purple-700 to-pink-700",
      badge: "Best Deal",
      link: "https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03", // ✅ Real Stripe link
      plan: "pro",
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
        "🪙 400 coins",
      ],
      color: "bg-gradient-to-br from-yellow-600 to-orange-600",
      badge: "Premium",
      link: "https://buy.stripe.com/test_9B6aEX5QF4sRgjA0td7ss02", // You can update this too
      plan: "business",
    },
  ];

  const handleClick = (plan) => {
    if (plan.link === "starter") {
      localStorage.setItem("droxion_plan", "Starter");

      const alreadyGiven = localStorage.getItem("starter_bonus_given");
      if (!alreadyGiven) {
        localStorage.setItem("droxion_coins", "50");
        localStorage.setItem("starter_bonus_given", "true");
        alert("✅ You're now on the free Starter plan. 50 free coins added!");
      } else {
        alert("✅ You're now on the free Starter plan.");
      }
    } else {
      localStorage.setItem("droxion_plan", plan.name);
      window.open(plan.link, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#111827] text-white px-4 py-10">
      <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 text-center mb-12 animate-fade-in">
        💳 Choose Your Magical Plan
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-7xl mx-auto animate-slide-up">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`${plan.color} rounded-3xl shadow-xl p-8 border border-gray-700 relative transform hover:scale-[1.03] transition-all duration-300 ease-in-out`}
          >
            <span className="absolute top-4 right-4 bg-white text-black text-xs font-bold px-3 py-1 rounded-full shadow-md animate-bounce">
              {plan.badge}
            </span>

            <h2 className="text-3xl font-bold mb-2 text-white tracking-wide">
              {plan.name}
            </h2>
            <p className="text-4xl font-extrabold text-green-300 mb-3">{plan.price}</p>
            <p className="text-sm text-gray-300 mb-6 italic">{plan.description}</p>

            <ul className="text-sm space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i}>✅ {f}</li>
              ))}
            </ul>

            <button
              onClick={() => handleClick(plan)}
              className="w-full bg-white text-black font-semibold px-6 py-3 rounded-xl hover:bg-gray-200 transition shadow-lg"
            >
              {plan.name === "Starter" ? "🚀 Get Started" : "🚀 Upgrade"}
            </button>

            {currentPlan === plan.name && (
              <div className="mt-5 text-xs bg-green-700 text-white px-3 py-1 rounded-full text-center">
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
