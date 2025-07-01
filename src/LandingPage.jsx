// ✅ LandingPage.jsx – Full Version with Preview & Stripe
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const user_id = localStorage.getItem("droxion_uid");
    if (!user_id) return;

    fetch("https://droxion-backend.onrender.com/check-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.paid) {
          setIsPaid(true);
          navigate("/chatboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [navigate]);

  return (
    <div className="landing-page">
      <div className="landing-glass">
        <h1 className="main-title">⚡ Droxion AI</h1>
        <p className="tagline">Create. Imagine. Build. All with One AI.</p>

        {!checking && !isPaid && (
          <a
            href="https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03"
            className="unlock-btn"
          >
            🔓 Unlock Full Power – $1.99/month
          </a>
        )}

        <div className="preview-grid">
          <div className="preview-box">
            <img src="/examples/image1.jpg" alt="AI Art" />
            <p>🎨 Cinematic Portrait</p>
          </div>
          <div className="preview-box">
            <video src="/examples/video1.mp4" autoPlay muted loop />
            <p>📺 AI Generated Video</p>
          </div>
          <div className="preview-box">
            <pre>{`// App UI Code\nfunction Start() {\n  return <Button title=\"Launch\" />\n}`}</pre>
            <p>💻 App Code Example</p>
          </div>
        </div>

        <ul className="feature-list">
          <li>✅ GPT-4 + Vision Support</li>
          <li>🖼️ 100+ Styles & Prompt Templates</li>
          <li>🚀 Make Apps, Shorts, Games Instantly</li>
          <li>📺 Generate Cinematic, Anime, Futuristic, Realistic Scenes</li>
          <li>💬 Type or Speak – Full Voice & Video Mode Built-in</li>
        </ul>

        <footer>
          Made by <b>Dhruv Patel</b> • <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
