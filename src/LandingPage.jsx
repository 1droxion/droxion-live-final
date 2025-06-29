// LandingPage.jsx
import React from "react";
import "./Landing.css";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing-container">
      <div className="card-glow">
        <h1>
          Welcome to <span className="droxion-gradient">Droxion</span>
        </h1>
        <p className="tagline">
          The <span className="highlight-green">#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>

        <div className="button-row">
          <Link to="/chatboard" className="button neon-pink">
            💬 Try AI Chat
          </Link>
          <Link to="/plans" className="button white-btn">
            🚀 Upgrade Plan
          </Link>
        </div>

        <div className="feature-list">
          <div>✨ What You Can Do With Droxion</div>
          <div>💬 Chat with AI powered by GPT-4</div>
          <div>🎨 Generate Images Instantly</div>
          <div>📺 Embed YouTube Videos</div>
          <div>🔓 No login needed. Start now.</div>
        </div>

        <div className="footer-note">
          Built by <strong>Dhruv Patel</strong> | Contact: <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
