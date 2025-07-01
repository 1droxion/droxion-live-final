// Landing.jsx
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
      .then(res => res.json())
      .then(data => {
        if (data.paid) {
          setIsPaid(true);
          navigate("/chatboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  return (
    <div className="landing-wrapper">
      <div className="glass-box">
        <h1 className="title">
          <span role="img" aria-label="zap">⚡</span> Droxion AI
        </h1>
        <p className="tagline">Create. Imagine. Build. All with One AI.</p>

        {!checking && !isPaid && (
          <a
            href="https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03"
            className="unlock-btn"
          >
            <span role="img" aria-label="lock">🔒</span> Unlock Full Power – $1.99/month
          </a>
        )}

        <div className="preview-boxes">
          <div className="preview-item">
            <img src="/examples/image1.jpg" alt="Cinematic" />
            <p>🎥 Cinematic Portrait</p>
          </div>
          <div className="preview-item">
            <video src="/examples/video1.mp4" autoPlay muted loop />
            <p>🤖 AI Generated Video</p>
          </div>
          <div className="preview-item code-box">
            <pre>{`// App UI Code
function Start() {
  return <Button title="Launch" />
}`}</pre>
            <p>💻 App Code Example</p>
          </div>
        </div>

        <ul className="features">
          <li>✅ GPT-4 + Vision Support</li>
          <li>📚 100+ Styles & Prompt Templates</li>
          <li>🚀 Make Apps, Shorts, Games Instantly</li>
        </ul>

        <footer>
          Made by <b>Dhruv Patel</b> • Contact: <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
