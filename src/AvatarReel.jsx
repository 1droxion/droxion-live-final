import React, { useState } from "react";
import axios from "axios";

function AvatarReel() {
  const [script, setScript] = useState("");
  const [avatarImage, setAvatarImage] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    setAvatarImage(e.target.files[0]);
  };

  const handleGenerate = async () => {
    if (!script.trim()) {
      alert("Please enter a script.");
      return;
    }
    if (!avatarImage) {
      alert("Please upload an avatar image.");
      return;
    }

    const formData = new FormData();
    formData.append("script", script);
    formData.append("image", avatarImage);

    setLoading(true);
    setVideoUrl("");

    try {
      const res = await axios.post("http://127.0.0.1:5001/avatar-reel", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.video_url) {
        setVideoUrl(res.data.video_url);
      } else {
        alert("❌ No video URL returned.");
      }
    } catch (err) {
      console.error("❌ D-ID Error:", err.response?.data || err.message);
      alert("Something went wrong. See console.");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 text-white min-h-screen">
      <h1 className="text-3xl font-bold text-purple-400 mb-6">🧠 Auto Avatar Reel Generator</h1>

      <textarea
        rows={4}
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Type what the avatar should say..."
        className="w-full p-4 rounded bg-gray-800 text-white mb-4 resize-none"
      />

      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="mb-4 text-white"
      />

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-bold"
      >
        {loading ? "Generating..." : "🎥 Generate Talking Reel"}
      </button>

      {videoUrl && (
        <div className="mt-6">
          <h2 className="text-xl mb-2">🧑‍🎤 AI Talking Avatar Video</h2>
          <video
            src={videoUrl}
            controls
            className="w-full max-w-xl rounded shadow border border-gray-600"
          />
        </div>
      )}
    </div>
  );
}

export default AvatarReel;
