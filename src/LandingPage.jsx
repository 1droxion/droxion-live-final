import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  // ✅ Allow free access for now
  useEffect(() => {
    navigate("/chatboard");
  }, [navigate]);

  return (
    <div className="landing-page">
      {/* ✅ Background Video */}
      <video autoPlay muted loop playsInline className="bg-video">
        <source src="/background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* ✅ Glass UI */}
      <div className="landing-glass">
        <h1 className="main-title">Droxion AI</h1>
        <p className="tagline">Create. Imagine. Build. All with One AI.</p>

        {/* ✅ Show Details Toggle */}
        <button
          className="unlock-btn"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide Details" : "See Details"}
        </button>

        {showDetails && (
          <>
            <div className="preview-grid">
              <div className="preview-box">
                <img src="/examples/image1.jpg" alt="AI Art" />
                <p>🎨 Cinematic Portrait</p>
              </div>

              <div className="preview-box">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="preview-video"
                >
                  <source src="/examples/video1.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <p>📺 AI Generated Video</p>
              </div>

              <div className="preview-box">
                <pre>
{`// App UI Code
function Start() {
  return <Button title="Launch" />;
}`}
                </pre>
                <p>💻 App Code Example</p>
              </div>
            </div>

            <ul className="feature-list">
              <li>✅ GPT-4 + Vision Support</li>
              <li>🎨 100+ Styles & Prompt Templates</li>
              <li>🚀 Make Apps, Shorts, Games Instantly</li>
              <li>📺 Cinematic, Anime, Realistic, 3D, Sci-Fi Styles</li>
            </ul>

            <footer>
              Made by <b>Dhruv Patel</b> •{" "}
              <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
