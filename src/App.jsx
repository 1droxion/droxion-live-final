import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaGem } from "react-icons/fa";
import { GiPartyPopper } from "react-icons/gi";
import "./App.css";

import Discover from "./Discover";
import UpgradePage from "./UpgradePage";
import Room from "./Room";
import VIPPopup from "./VIPPopup";
import Login from "./Login";
import Landing from "./Landing";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoom = location.pathname === "/call";
  const isHome = location.pathname === "/";
  const isDiscover = location.pathname === "/discover";
  const isPlans = location.pathname === "/plans";
  const isAbout = location.pathname === "/about";

  const [cameraAllowed, setCameraAllowed] = useState(null);
  const [user, setUser] = useState(null);
  const [gender, setGender] = useState("any");
  const [country, setCountry] = useState("any");
  const [message, setMessage] = useState("");
  const [showVIPPopup, setShowVIPPopup] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("winkly_user");
    if (stored) setUser(JSON.parse(stored));

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setCameraAllowed(true);
        const video = document.querySelector("video");
        if (video) video.srcObject = stream;
      })
      .catch(() => setCameraAllowed(false));
  }, []);

  const handleConnect = () => {
    setMessage("🔗 Connecting to match...");
    navigate(`/call?gender=${gender}&country=${country}`);
  };

  const renderPolicyFooter = () => (
    <div style={{ marginTop: 40, fontSize: "0.85rem", color: "#aaa", textAlign: "center" }}>
      <p><strong>Terms of Service:</strong> You must be 18+ to use this platform. Harassment, nudity, or abuse is banned.</p>
      <p><strong>Privacy Policy:</strong> We only store essential data to run the platform. We don’t sell or share personal info.</p>
      <p><strong>No Refund Policy:</strong> All payments (VIP, Coins, Gifts) are final and non-refundable.</p>
    </div>
  );

  if (!ageConfirmed) {
    return (
      <div style={{ textAlign: "center", paddingTop: "20vh" }}>
        <h2 style={{ color: "#ffd700", fontSize: "2rem" }}>🔞 Are you 18 or older?</h2>
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setAgeConfirmed(true)} style={{ padding: "10px 20px", fontSize: "1rem", background: "#ffd700", border: "none", borderRadius: 10 }}>Yes, Enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="winkly">
      {showVIPPopup && <VIPPopup onClose={() => setShowVIPPopup(false)} />}

      {!isRoom && !isAbout && (
        <div className="sidebar">
          <button onClick={() => navigate("/")}><FaHome size={20} color="#000" /></button>
          <button onClick={() => navigate("/discover")}><GiPartyPopper size={20} color="#000" /></button>
          <button onClick={() => navigate("/plans")}><FaGem size={20} color="#000" /></button>
        </div>
      )}

      {!isRoom && !isAbout && (
        <div className="main-panel">
          {isHome && (
            <>
              <h1 style={{ textAlign: "center", color: "#ffd700", fontSize: "2.4rem", marginBottom: 20 }}>
                Winkly Live ★
              </h1>

              <div className="selectors">
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="any">Any Gender</option>
                  <option value="boy">Boy</option>
                  <option value="girl">Girl</option>
                </select>
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="any">Any Country</option>
                  <option value="us">USA</option>
                  <option value="in">India</option>
                  <option value="br">Brazil</option>
                  <option value="ru">Russia</option>
                  <option value="mx">Mexico</option>
                </select>
                <button
                  onClick={handleConnect}
                  style={{
                    padding: "12px 26px",
                    background: "#ffd700",
                    color: "#000",
                    borderRadius: "12px",
                    border: "none",
                    fontSize: "1rem",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Connect
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: 20 }}>
                {user && (
                  <p style={{ fontSize: "1rem" }}>
                    💰 Coins: <strong>{user.coins}</strong> {user.vip && "(VIP 🔥 Unlimited)"}
                  </p>
                )}
              </div>

              <div className="video-box" style={{ justifyContent: "center", marginTop: 30 }}>
                {cameraAllowed === false ? (
                  <p className="error">🚫 Camera access denied.</p>
                ) : (
                  <video autoPlay muted playsInline className="preview" style={{
                    width: "100%",
                    maxWidth: "480px",
                    borderRadius: "18px",
                    border: "3px solid #ffd700",
                    boxShadow: "0 0 30px #ffd70055"
                  }} />
                )}
              </div>

              <div className="chat-box" style={{ marginTop: 30, textAlign: "center" }}>
                <p style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#eee" }}>
                  Matched with: <span style={{ color: "#ffd700" }}>{gender.toUpperCase()}</span> from <span style={{ color: "#ffd700" }}>{country.toUpperCase()}</span>
                </p>
                <div style={{
                  marginTop: 10,
                  padding: "10px 16px",
                  background: "#2c2c2c",
                  borderRadius: "10px",
                  color: "#ccc",
                  display: "inline-block",
                  fontSize: "0.95rem"
                }}>
                  💬 {message || (cameraAllowed === false ? "Camera blocked..." : "Waiting for message...")}
                </div>
              </div>
            </>
          )}

          {isPlans && <UpgradePage />}
          {isDiscover && <Discover gender={gender} country={country} />}

          {renderPolicyFooter()}
        </div>
      )}

      {isAbout && <Landing />}

      <Routes>
        <Route path="/" element={<div />} />
        <Route path="/discover" element={<div />} />
        <Route path="/plans" element={<div />} />
        <Route path="/call" element={<Room />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<Landing />} />
      </Routes>
    </div>
  );
}

export default App;
