import React, { useState } from "react";
import axios from "axios";

function AutoGenerator() {
  const [formData, setFormData] = useState({
    topic: "Motivation",
    language: "English",
    voice: "onyx",
    style: "Cinematic",
    length: "Medium",
    captions: "Word-by-Word",
    subtitlePosition: "Bottom",
    branding: "Yes",
    musicVolume: "Medium Volume",
    clipCount: 10,
    voiceSpeed: 1.0,
    fontPath: "NotoSans-Regular.ttf",
    manualScript: "no",
    userScript: "",
    mode: "Auto",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoReady, setVideoReady] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAutoGenerate = async () => {
    const user = JSON.parse(localStorage.getItem("droxion_user"));
    if (!user || user.credits < 1) {
      alert("❌ Not enough credits. Please upgrade your plan.");
      return;
    }

    setIsLoading(true);
    setVideoReady(false);
    setVideoUrl("");

    try {
      const res = await axios.post("http://localhost:5000/generate", formData, {
        headers: { "Content-Type": "application/json" },
      });

      const { videoUrl } = res.data;
      setVideoUrl(videoUrl);
      setVideoReady(true);

      user.credits -= 1;
      localStorage.setItem("droxion_user", JSON.stringify(user));
    } catch (err) {
      console.error("❌ API ERROR:", err.response?.data || err.message);
      alert("❌ Generation failed: " + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white flex flex-col items-center justify-center px-4 py-10">
      <h1 className="text-4xl font-bold text-green-400 mb-6">⚡ Auto Reel Generator</h1>

      <div className="w-full max-w-md space-y-4">
        {/* Topic Selector */}
        <div>
          <label className="block text-sm mb-1 text-gray-300">🎯 Select Topic</label>
          <select
            name="topic"
            value={formData.topic}
            onChange={handleChange}
            className="input"
          >
            <option>Motivation</option>
            <option>Success</option>
            <option>Love</option>
            <option>Business</option>
            <option>Health</option>
          </select>
        </div>

        {/* Auto Generate Button */}
        <button
          onClick={handleAutoGenerate}
          disabled={isLoading}
          className={`w-full py-3 rounded-xl font-bold text-lg transition ${
            isLoading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {isLoading ? "⏳ Generating..." : "🚀 Generate Reel"}
        </button>

        {/* Video Preview */}
        {videoReady && videoUrl && (
          <div className="mt-8 text-center animate-fade-in">
            <video src={videoUrl} controls className="w-full max-w-md rounded-xl mb-4 shadow-lg border border-gray-700" />
            <div className="flex justify-center gap-4">
              <a
                href={videoUrl}
                download
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                ⬇️ Download
              </a>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                ▶️ Fullscreen
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AutoGenerator;
