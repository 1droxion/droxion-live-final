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
      .catch(() => {
        setChecking(false);
      });
  }, [navigate]);

  return (
    <div className="landing">
      <div className="glass">
        <h1 className="main-title">
          Welcome to <span>DROXION</span>
        </h1>
        <p className="tagline">The Future of Creation Starts Here</p>

        {!checking && !isPaid && (
          <a
            href="https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03"
            className="pay-btn"
          >
            🔓 Unlock Everything — $1.99/month
          </a>
        )}

        <div className="preview-section">
          <h2>🌌 AI Image Outputs</h2>
          <div className="image-row">
            <img src="/examples/img1.jpg" alt="Style 1" />
            <img src="/examples/img2.jpg" alt="Style 2" />
            <img src="/examples/img3.jpg" alt="Style 3" />
          </div>

          <h2>🎬 AI Video Previews</h2>
          <div className="video-row">
            <video src="/examples/vid1.mp4" controls muted />
            <video src="/examples/vid2.mp4" controls muted />
          </div>

          <h2>💡 Smart Code Outputs</h2>
          <pre className="code-block">
{`// Build a game in JS
let score = 0;
function play() {
  score += 1;
}`}
          </pre>
        </div>

        <ul className="features">
          <li>✅ Smart AI Chat (GPT-4)</li>
          <li>🎨 100+ One-Click Image Styles</li>
          <li>📱 Make Games, Tools, Apps Instantly</li>
          <li>📺 Watch Code Videos In-App</li>
        </ul>

        <footer>
          Made by <b>Dhruv Patel</b> — <a href="mailto:droxionhalp@gmail.com">Contact Us</a>
        </footer>
      </div>
    </div>
  );
}
