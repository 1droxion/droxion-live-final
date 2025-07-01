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
      <div className="glass-box">
        <h1 className="title">
          🚀 Welcome to <span className="highlight">Droxion</span>
        </h1>
        <p className="subtitle">
          Your <span className="tagline">AI Super Assistant</span> — Generate anything you imagine.
        </p>

        {!checking && !isPaid && (
          <a
            href="https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03"
            className="pay-button"
          >
            🔓 Unlock Full Power for $1.99/month
          </a>
        )}

        <div className="example-section">
          <h2>🎨 AI Image Styles</h2>
          <div className="preview-grid">
            <img src="/examples/image1.jpg" alt="Cinematic" />
            <img src="/examples/image2.jpg" alt="Anime" />
            <img src="/examples/image3.jpg" alt="Fantasy" />
          </div>

          <h2>📺 YouTube AI Videos</h2>
          <div className="video-grid">
            <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="AI Video 1" />
            <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="AI Video 2" />
          </div>

          <h2>💻 Code Examples</h2>
          <pre className="code-snippet">
// Flutter UI
Column(
  children: [Text("AI App"), Button("Start")]
)
          </pre>
        </div>

        <ul className="features">
          <li>✅ Unlimited GPT-4 Chat</li>
          <li>🎨 100+ Image Styles (1-Click)</li>
          <li>📱 Build Apps, Tools, Games via Prompt</li>
          <li>📺 Watch Code Videos In-App</li>
          <li>🔥 All Features After Payment</li>
        </ul>

        <footer>
          Built by <b>Dhruv Patel</b> | <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
