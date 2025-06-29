import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";
import { FaRocket, FaRobot, FaMagic, FaPalette, FaYoutube, FaLock } from "react-icons/fa";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-box">
        <h1>
          Welcome to <span className="brand">Droxion</span>
        </h1>
        <p className="subtitle">
          The <span className="highlight">#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>

        <div className="landing-buttons">
          <button className="chat-btn" onClick={() => navigate("/chatboard")}>💬 Try AI Chat</button>
          <button className="plan-btn" onClick={() => navigate("/plans")}>🚀 Upgrade Plan</button>
        </div>

        <div className="features-list">
          <p><FaRocket /> What You Can Do With Droxion</p>
          <p><FaRobot /> Ask Anything — Chat with AI powered by GPT-4</p>
          <p><FaPalette /> Generate Stunning Images in seconds</p>
          <p><FaYoutube /> Search & Embed YouTube Videos</p>
          <p><FaLock /> No login needed, start instantly</p>
        </div>

        <div className="footer">
          Created by <strong>Dhruv Patel</strong> | Contact: <span>droxionhalp@gmail.com</span>
        </div>
      </div>
    </div>
  );
}
