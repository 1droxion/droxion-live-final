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
      .catch(() => setChecking(false));
  }, [navigate]);

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Welcome to <span className="droxion">Droxion</span></h1>
        <p className="subtitle">Your All-in-One AI Creation Studio — <span className="highlight">Generate. Chat. Create.</span></p>

        {!checking && !isPaid && (
          <>
            <a href="https://buy.stripe.com/14AaEX0vr3NidTX0SS97G03" className="btn gradient-green">
              🎨 Try AI Image Generator
            </a>
            <a href="/chatboard" className="btn white-btn">
              💬 Ask AI Anything
            </a>
          </>
        )}

        <ul className="features">
          <li>✅ GPT-4 + Vision Chat</li>
          <li>🖼️ 100+ Image Styles</li>
          <li>📱 Build Games, Apps & More</li>
          <li>📺 YouTube Code + Reels</li>
        </ul>

        <footer>
          Made by <b>Dhruv Patel</b> • <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
