import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-box">
        <h1>
          Welcome to <span className="highlight">Droxion</span>
        </h1>
        <p className="subtitle">
          The <span className="green">#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>
        <div className="button-row">
          <button className="primary" onClick={() => navigate("/chatboard")}>💬 Try AI Chat</button>
          <button className="secondary" onClick={() => navigate("/plans")}>🚀 Upgrade Plan</button>
        </div>

        <div className="features">
          <p>✨ What You Can Do With Droxion</p>
          <p>🧠 Ask Anything — Chat with AI powered by GPT-4</p>
          <p>🎨 Generate Stunning Images in seconds</p>
          <p>📺 Search & Embed YouTube Videos</p>
          <p>🔓 No login needed, start instantly</p>
        </div>

        <p className="footer">
          Created by <strong>Dhruv Patel</strong> | Contact: <span className="email">droxionhalp@gmail.com</span>
        </p>
      </div>
    </div>
  );
}
