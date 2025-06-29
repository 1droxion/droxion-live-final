import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-v2-container">
      <div className="neon-glass-box">
        <h1 className="neon-title">
          Welcome to <span className="glow-text">Droxion</span>
        </h1>
        <p className="neon-sub">
          The <span className="ai-green">#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>

        <div className="neon-buttons">
          <button className="neon-chat" onClick={() => navigate("/chatboard")}>💬 Try AI Chat</button>
          <button className="neon-plan" onClick={() => navigate("/plans")}>🚀 Upgrade Plan</button>
        </div>

        <div className="neon-list">
          <p>✨ What You Can Do With Droxion</p>
          <p>💬 Chat with AI powered by GPT-4</p>
          <p>🎨 Generate Images Instantly</p>
          <p>📺 Embed YouTube Videos</p>
          <p>🔐 No login needed. Start now.</p>
        </div>

        <div className="neon-footer">
          Built by <strong>Dhruv Patel</strong> | Contact: <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
