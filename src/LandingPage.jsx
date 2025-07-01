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
    <div className="hero-bg">
      <div className="glass-ui">
        <h1 className="glow-title">DROXION</h1>
        <p className="subtitle">Your Personal AI Universe</p>

        <ul className="hero-list">
          <li>💡 Generate Ideas, Apps, Images, and More</li>
          <li>🧠 Powered by GPT-4 + Image + Video AI</li>
          <li>🚀 No Prompt Needed — Just Click & Go</li>
        </ul>

        {!checking && !isPaid && (
          <a
            href="https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03"
            className="glow-button"
          >
            🔓 Unlock AI Power — $1.99/month
          </a>
        )}

        <div className="grid-preview">
          <div className="grid-item">
            <img src="/examples/image1.jpg" alt="AI Image" />
            <span>🎨 Cinematic Art</span>
          </div>
          <div className="grid-item">
            <video src="/examples/video1.mp4" muted loop autoPlay />
            <span>📺 AI Short Video</span>
          </div>
          <div className="grid-item">
            <pre>
{`// App UI with Flutter
Column(
  children: [Text("Droxion App")]
)`}
            </pre>
            <span>💻 Code Output</span>
          </div>
        </div>

        <footer>
          Built by <b>Dhruv Patel</b> | <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
