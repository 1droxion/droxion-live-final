import React, { useState } from "react";
import axios from "axios";

function AIStyle() {
  const [file, setFile] = useState(null);
  const [style, setStyle] = useState("Ghibli");
  const [outputUrl, setOutputUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const stylePrompts = {
    Ghibli: "In Ghibli anime style",
    Sketch: "Make this image look like a pencil sketch",
    "3D": "Convert to 3D cartoon style",
    Cartoon: "Make this look like a cartoon character",
    Pixel: "Turn this image into pixel art",
  };

  const handleUpload = async () => {
    if (!file) return alert("Please upload an image first.");
    setLoading(true);
    setOutputUrl("");

    try {
      // 1. Upload image to backend
      const uploadForm = new FormData();
      uploadForm.append("image", file);

      const uploadRes = await axios.post(
        "http://localhost:5000/upload-image",
        uploadForm,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const imageUrl = uploadRes.data.image_url;

      // 2. Trigger AI style generation using image URL + style
      const res = await axios.post("http://localhost:5000/ai-style", {
        imageUrl: imageUrl,
        style: style,
      });

      setOutputUrl(res.data.styledUrl);
    } catch (err) {
      console.error("❌ AI Style Error:", err.response?.data || err.message);
      alert("❌ Failed to style image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 text-white h-[calc(100vh-80px)]">
      <h1 className="text-2xl font-bold text-blue-400 mb-6">
        🎨 AI Style Transformer
      </h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col gap-4 w-full md:w-1/2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-white"
          />

          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="p-2 rounded text-black"
          >
            {Object.keys(stylePrompts).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={handleUpload}
            disabled={loading}
            className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
          >
            {loading ? "Styling..." : "🎨 Convert"}
          </button>
        </div>

        {outputUrl && (
          <div className="w-full md:w-1/2">
            <img
              src={outputUrl}
              alt="Styled"
              className="w-full rounded border mt-4"
            />
            <a
              href={outputUrl}
              download="styled_output.png"
              className="block mt-3 bg-blue-600 p-2 rounded text-center"
            >
              ⬇️ Download Image
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIStyle;
