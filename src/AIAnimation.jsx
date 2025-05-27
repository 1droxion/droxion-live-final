import React, { useState } from "react";
import axios from "axios";

function AIAnimation() {
  const [prompt, setPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageUploaded, setImageUploaded] = useState(false);

  const handleImageUpload = async () => {
    if (!imageFile) return;
    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      await axios.post("http://localhost:5000/upload-image", formData);
      setImageUploaded(true);
      alert("✅ Image uploaded successfully!");
    } catch (err) {
      alert("❌ Failed to upload image.");
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!imageUploaded) {
      alert("Please upload an image first.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/ai-image-video", { prompt });
      setVideoUrl(res.data.video_url);
    } catch (err) {
      alert("❌ Failed to generate animation.");
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🎞 AI Image + Prompt Animation</h2>

      {/* Image Upload */}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImageFile(e.target.files[0])}
        className="mb-2 block"
      />
      <button
        onClick={handleImageUpload}
        className="mb-4 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        Upload Image
      </button>

      {/* Prompt Input */}
      <input
        type="text"
        placeholder="e.g., zoom into a neon city at night"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="border p-2 w-full text-black rounded bg-white mb-4"
      />

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      {/* Output Video */}
      {videoUrl && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">🎬 Generated Animation:</h3>
          <video src={videoUrl} controls width="480" className="rounded shadow" />
          <a
            href={videoUrl}
            download="animated_video.mp4"
            className="block mt-2 text-green-500 font-semibold"
          >
            ⬇️ Download Video
          </a>
        </div>
      )}
    </div>
  );
}

export default AIAnimation;
