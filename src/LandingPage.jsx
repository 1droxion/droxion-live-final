import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css"; // Make sure this CSS file exists

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-box">
        <h1 className="landing-title">
          Welcome to <span style={{ color: "#B877F8" }}>Droxion</span>
        </h1>
        <p className="landing-sub">
          The <span style={{ color: "#38f88f", fontWeight: "bold" }}>#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>

        <div className="landing-buttons">
          <button onClick={() => navigate("/chatboard")} className="landing-btn btn-purple">
            💬 Try AI Chat
          </button>
          <button onClick={() => navigate("/generator")} className="landing-btn btn-white">
            🎞️ Try AI Video
          </button>
          <button onClick={() => navigate("/plans")} className="landing-btn btn-white">
            🚀 Upgrade Plan
          </button>
        </div>

        <div style={{ marginTop: "2rem", textAlign: "left" }}>
          <p>💡 What You Can Do With Droxion</p>
          <p>🧠 Ask Anything — Chat with AI powered by GPT-4</p>
          <p>🎨 Generate Stunning Images in seconds</p>
          <p>📺 Search & Embed YouTube Videos</p>
          <p>🔒 No login needed, start instantly</p>
        </div>

        <p className="landing-footer">
          Created by <strong>Dhruv Patel</strong> | Contact: <span style={{ fontWeight: "bold" }}>droxionhalp@gmail.com</span>
        </p>
      </div>
    </div>
  );
}
