import React from "react";

function VIPPopup({ onClose }) {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "#111",
        padding: 30,
        borderRadius: 16,
        textAlign: "center",
        maxWidth: 360,
        color: "#fff"
      }}>
        <h2 style={{ color: "#ffd700" }}>🔒 VIP Access Required</h2>
        <p style={{ margin: "15px 0" }}>
          Connect feature is only available for VIP members.
        </p>
        <a href="https://buy.stripe.com/dRm3cvemh4Rm9DH9po97G06" target="_blank" rel="noreferrer">
          <button style={{
            background: "#ffd700",
            color: "#000",
            padding: "12px 20px",
            fontWeight: "bold",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer"
          }}>
            🔥 Upgrade to VIP
          </button>
        </a>
        <div>
          <button onClick={onClose} style={{
            marginTop: 20,
            background: "transparent",
            color: "#999",
            border: "none",
            cursor: "pointer"
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default VIPPopup;
