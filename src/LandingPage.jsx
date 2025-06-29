import React from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <h1 style={styles.welcome}>Welcome to <span style={styles.droxion}>Droxion</span></h1>
        <p style={styles.subtitle}>
          The <span style={styles.highlight}>#1 AI Reel Generator</span> — From Script to Upload in Seconds.
        </p>

        <div style={styles.buttonGroup}>
          <button style={styles.tryButton} onClick={() => navigate("/plans")}>🚀 Try It Free Now</button>
          <button style={styles.demoButton} onClick={() => navigate("/chatboard")}>🎬 See AI Demo</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    textAlign: "center",
    color: "#fff",
    fontFamily: "Poppins, sans-serif",
  },
  inner: {
    maxWidth: 600,
    padding: 24,
    borderRadius: 20,
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 0 25px rgba(0,0,0,0.5)"
  },
  welcome: {
    fontSize: "2.4rem",
    fontWeight: 700,
    marginBottom: 16
  },
  droxion: {
    color: "#b388ff"
  },
  subtitle: {
    fontSize: "1.1rem",
    marginBottom: 30,
    color: "#ccc"
  },
  highlight: {
    color: "#42f5a1",
    fontWeight: 600
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap"
  },
  tryButton: {
    background: "linear-gradient(to right, #ff5edf, #04c8de)",
    border: "none",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
    transition: "transform 0.2s ease"
  },
  demoButton: {
    background: "#fff",
    color: "#000",
    border: "none",
    borderRadius: 12,
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.2s ease"
  }
};
