import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="glass-box">
        <h1>Welcome to <span>Droxion</span></h1>
        <p>
          The <span className="highlight">#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>
        <div className="button-row">
          <button className="btn-gradient" onClick={() => navigate("/chatboard")}>💬 Try It Free Now</button>
          <button className="btn-outline" onClick={() => navigate("/ai-image")}>🖼️ See AI Demo</button>
        </div>
      </div>

      <div className="info-section">
        <h2>✨ What You Can Do With Droxion</h2>
        <ul>
          <li>🧠 Ask Anything — Chat with AI powered by GPT-4</li>
          <li>🎨 Generate Stunning Images in seconds</li>
          <li>📺 Search & Embed YouTube Videos</li>
          <li>🔐 No login needed, start instantly</li>
        </ul>
      </div>

      <footer className="footer">
        Created by Dhruv Patel | Contact: droxionhalp@gmail.com
      </footer>
    </div>
  );
}
