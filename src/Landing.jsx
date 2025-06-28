import React from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 30, maxWidth: 800, margin: "0 auto", color: "white" }}>
      <h1 style={{ fontSize: "3rem", color: "#ffd700", textAlign: "center" }}>✨ Welcome to Winkly.fun</h1>
      <p style={{ fontSize: "1.2rem", textAlign: "center", marginBottom: 30 }}>
        Start live, anonymous video chats. Meet real people instantly.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "#111", padding: 20, borderRadius: 12 }}>
          <h2>⚡ Fast Match</h2>
          <p>Click connect and get matched in seconds.</p>
        </div>

        <div style={{ background: "#111", padding: 20, borderRadius: 12 }}>
          <h2>🚻 Gender Filter</h2>
          <p>Select who you want to talk to: Boys, Girls, or Anyone.</p>
        </div>

        <div style={{ background: "#111", padding: 20, borderRadius: 12 }}>
          <h2>🔥 VIP Access</h2>
          <p>Unlock unlimited matches and filters with VIP.</p>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 40 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#ffd700",
            color: "#000",
            padding: "12px 30px",
            fontSize: "1.1rem",
            fontWeight: "bold",
            border: "none",
            borderRadius: 10,
            cursor: "pointer"
          }}
        >
          Start Now
        </button>
      </div>

      <div style={{ marginTop: 50, fontSize: "0.85rem", color: "#aaa", textAlign: "center" }}>
        <p><strong>Terms of Service:</strong> You must be 18+ to use Winkly. No nudity, hate, or abuse allowed.</p>
        <p><strong>Privacy Policy:</strong> We store minimal data. No info is sold or shared.</p>
        <p><strong>No Refund Policy:</strong> All coin and VIP purchases are final.</p>
      </div>
    </div>
  );
}
