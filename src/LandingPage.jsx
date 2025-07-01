import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css"; // ✅ Only import the CSS, don’t paste it here

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="overlay" />
      <div className="content">
        <h1 className="title">THE FUTURE IS AI</h1>
        <p className="subtitle">
          Unlock videos, images, games & more powered by artificial intelligence.
        </p>
        <button className="start-btn" onClick={() => navigate("/chatboard")}>
          🔓 Start Now
        </button>
      </div>
      <div className="bottom-info">
        <p>Created by Dhruv Patel • Powered by Droxion AI ⚡</p>
      </div>
    </div>
  );
}
