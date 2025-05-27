import React, { useState } from "react";
import axios from "axios";

function Generator() {
  const [formData, setFormData] = useState({
    mode: "Manual",
    topic: "",
    language: "English",
    manualScript: "no",
    userScript: "",
    voice: "onyx",
    style: "Cinematic",
    length: "Medium",
    captions: "Word-by-Word",
    subtitlePosition: "Bottom",
    branding: "Yes",
    musicVolume: "Medium Volume",
    clipCount: 10,
    voiceSpeed: 1.0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.topic.trim() && formData.mode !== "Manual") {
      alert("❗ Please enter a topic.");
      return;
    }

    setIsLoading(true);
    setVideoUrl("");

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/generate`, formData);
      if (res.data.video_url) {
        setVideoUrl(res.data.video_url);
      } else {
        alert("⚠️ No video returned.");
      }
    } catch (err) {
      console.error("❌ Generate Error:", err);
      alert("❌ Something went wrong.");
    }

    setIsLoading(false);
  };

  return (
    <div className="p-6 text-white bg-[#111827] min-h-screen">
      <h1 className="text-4xl font-extrabold text-green-400 mb-8">🎬 AI Reel Generator</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Controls */}
        <div className="space-y-4 max-w-lg">
          <select name="mode" value={formData.mode} onChange={handleChange} className="input">
            <option value="Auto">Auto Mode</option>
            <option value="Manual">Manual Mode</option>
          </select>

          {formData.mode === "Manual" ? (
            <textarea
              name="userScript"
              rows={3}
              value={formData.userScript}
              onChange={handleChange}
              placeholder="✍️ Write your own script..."
              className="input resize-none"
            />
          ) : (
            <input
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              placeholder="💡 Enter a topic like 'Success'"
              className="input"
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <select name="language" value={formData.language} onChange={handleChange} className="input">
              <option>English</option>
              <option>Hindi</option>
              <option>Gujarati</option>
            </select>

            <select name="voice" value={formData.voice} onChange={handleChange} className="input">
              <option value="onyx">Onyx</option>
              <option value="nova">Nova</option>
              <option value="echo">Echo</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <select name="style" value={formData.style} onChange={handleChange} className="input">
              <option>Cinematic</option>
              <option>Emotional</option>
              <option>Fast-Paced</option>
            </select>

            <select name="length" value={formData.length} onChange={handleChange} className="input">
              <option>Short</option>
              <option>Medium</option>
              <option>Long</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <select name="captions" value={formData.captions} onChange={handleChange} className="input">
              <option>Word-by-Word</option>
              <option>Sentence</option>
              <option>None</option>
            </select>

            <select
              name="subtitlePosition"
              value={formData.subtitlePosition}
              onChange={handleChange}
              className="input"
            >
              <option>Bottom</option>
              <option>Center</option>
              <option>Top</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <select name="branding" value={formData.branding} onChange={handleChange} className="input">
              <option>Yes</option>
              <option>No</option>
            </select>

            <select name="musicVolume" value={formData.musicVolume} onChange={handleChange} className="input">
              <option>Low Volume</option>
              <option>Medium Volume</option>
              <option>High Volume</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              name="clipCount"
              value={formData.clipCount}
              onChange={handleChange}
              placeholder="🎞️ Clip Count"
              className="input"
            />
            <input
              type="number"
              name="voiceSpeed"
              step="0.1"
              value={formData.voiceSpeed}
              onChange={handleChange}
              placeholder="🎙️ Voice Speed"
              className="input"
            />
          </div>
        </div>

        {/* Right Preview */}
        <div className="flex flex-col items-center justify-center space-y-6">
          {videoUrl ? (
            <video src={videoUrl} controls className="w-full rounded-lg shadow-xl border border-gray-700" />
          ) : (
            <div className="italic text-gray-500 text-center">🎞️ Your video will appear here after generation.</div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full text-lg font-bold py-3 rounded-xl transition ${
              isLoading ? "bg-gray-600 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isLoading ? "Generating..." : "🚀 Generate AI Reel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Generator;
