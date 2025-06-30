import React, { useEffect } from "react";
import "./Landing.css";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // If user already paid, redirect to chatboard
    const isPaid = localStorage.getItem("paid");
    if (isPaid === "true") {
      navigate("/chatboard");
    }
  }, [navigate]);

  const handlePayment = () => {
    // Redirect to Stripe payment page
    window.location.href = "https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03";
  };

  // After payment, user will return to site manually or auto — so handle check from somewhere
  useEffect(() => {
    // Example: add ?paid=1 to the URL after Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      localStorage.setItem("paid", "true");
      navigate("/chatboard");
    }
  }, []);

  return (
    <div className="landing">
      <div className="glass-box">
        <h1>
          Welcome to <span className="highlight">Droxion</span>
        </h1>
        <p className="subtitle">
          The <span className="tagline">#1 AI Assistant</span> — Build Apps, Games, Images, Code, and More Instantly.
        </p>

        <div className="buttons">
          <button onClick={handlePayment} className="primary-button">
            🔓 Unlock All for $1.99/month
          </button>
        </div>

        <ul className="features">
          <li>✅ Unlimited AI Chat (GPT-4)</li>
          <li>🎨 100+ Image Styles (Coding Prompts)</li>
          <li>💻 Make Apps, Games, Tools via AI</li>
          <li>📺 Watch Code YouTube Videos In-App</li>
          <li>🔥 All Features Unlocked After Payment</li>
        </ul>

        <footer>
          Built by <b>Dhruv Patel</b> | Contact: <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
