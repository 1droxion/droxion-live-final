import React from "react";
import "./Landing.css";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="glass-box">
        <h1>
          Welcome to <span className="highlight">Droxion</span>
        </h1>
        <p className="subtitle">
          The <span className="tagline">#1 AI Assistant</span> — From Image, Chat, and Video Generator in Seconds.
        </p>

        <div className="buttons">
          <Link to="/chatboard" className="primary-button">
            💬 Try AI Chat
          </Link>
          <Link to="/plans" className="secondary-button">
            🚀 Upgrade Plan
          </Link>
        </div>

        <ul className="features">
          <li>💡 What You Can Do With Droxion</li>
          <li>🧠 Chat with AI powered by GPT-4</li>
          <li>🎨 Generate Images Instantly</li>
          <li>📺 Embed YouTube Videos</li>
          <li>🔓 No login needed. Start now.</li>
        </ul>

        {/* 🔍 Example Section */}
        <div className="preview-section mt-10 text-left max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold mb-4">🔍 Preview What Droxion Can Do</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <img src="/preview1.jpg" alt="Generated Art" className="rounded-xl shadow-md" />
            <iframe
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Droxion Video Demo"
              className="rounded-xl shadow-md w-full h-52"
              allowFullScreen
            ></iframe>
            <div className="bg-gray-900 p-3 rounded-xl shadow-md text-sm">
              <code>// Game Example<br />function start() {'{'} console.log('Begin!') {'}'}</code>
            </div>
            <img src="/preview2.jpg" alt="Futuristic Scene" className="rounded-xl shadow-md" />
          </div>
          <p className="text-sm mt-4 text-gray-400 italic">
            All generated using Droxion AI. Unlock full power inside.
          </p>
        </div>

        <footer>
          Built by <b>Dhruv Patel</b> | Contact: <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a>
        </footer>
      </div>
    </div>
  );
}
