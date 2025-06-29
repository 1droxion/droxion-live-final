// src/Landing.jsx

import React from "react";
import { Link } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  return (
    <div className="landing-container">
      <h1 className="landing-title">Droxion ✦ AI Super Brain</h1>
      <p className="landing-subtitle">
        Instantly generate videos, images, and smart answers.
      </p>

      <div className="landing-buttons">
        <Link to="/chat" className="landing-btn">💬 Try AI Chat</Link>
        <Link to="/image" className="landing-btn">🖼️ Generate Image</Link>
        <Link to="/video" className="landing-btn">🎬 Make Video</Link>
      </div>

      <div className="landing-footer">
        <p>Created by <strong>Dhruv Patel</strong> · © {new Date().getFullYear()} Droxion</p>
      </div>
    </div>
  );
}
