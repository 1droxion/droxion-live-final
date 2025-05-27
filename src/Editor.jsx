import React, { useState } from "react";

function Editor() {
  const [videos, setVideos] = useState([]);
  const [images, setImages] = useState([]);
  const [audios, setAudios] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const handleFileChange = (e, type) => {
    const files = Array.from(e.target.files);
    if (type === "video") setVideos([...videos, ...files]);
    else if (type === "image") setImages([...images, ...files]);
    else if (type === "audio") setAudios([...audios, ...files]);
  };

  const generatePreview = async () => {
    if (!videos.length && !images.length && !audios.length) {
      alert("❗ Please upload at least one file.");
      return;
    }

    setLoadingPreview(true);
    setPreviewUrl("");

    const formData = new FormData();
    videos.forEach((file) => formData.append("videos", file));
    images.forEach((file) => formData.append("images", file));
    audios.forEach((file) => formData.append("audios", file));

    try {
      const res = await fetch("http://localhost:5001/generate-edit", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setPreviewUrl(data.video_url || "");
    } catch (err) {
      console.error("❌ Error generating preview:", err);
      alert("Error generating preview. Check backend.");
    }

    setLoadingPreview(false);
  };

  const FileCard = ({ icon, title, files, type }) => (
    <div className="bg-[#1e293b]/80 p-5 rounded-2xl border border-gray-700 shadow-xl backdrop-blur">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="text-2xl">{icon}</span> {title}
      </h2>

      <label className="block w-full cursor-pointer bg-black/30 border border-gray-600 rounded-md p-3 text-sm hover:bg-gray-800 transition">
        Select {type} files...
        <input
          type="file"
          accept={`${type}/*`}
          multiple
          onChange={(e) => handleFileChange(e, type)}
          className="hidden"
        />
      </label>

      {files.length > 0 && (
        <div className="mt-4 max-h-40 overflow-y-auto space-y-2 text-sm">
          {files.map((f, i) => (
            <div key={i} className="bg-black/40 px-3 py-2 rounded flex items-center gap-2 text-white truncate">
              <span>{icon}</span>
              <span className="truncate">{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <h1 className="text-4xl font-extrabold text-center text-green-400 mb-12">
        🎬 AI Upload Editor
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FileCard icon="🎥" title="Upload Videos" files={videos} type="video" />
        <FileCard icon="🖼️" title="Upload Images" files={images} type="image" />
        <FileCard icon="🎧" title="Upload Music" files={audios} type="audio" />
      </div>

      {/* Generate Preview Button */}
      <div className="flex justify-center mt-10">
        <button
          onClick={generatePreview}
          disabled={loadingPreview}
          className="bg-gradient-to-br from-blue-500 to-green-500 hover:from-green-600 hover:to-lime-500 px-10 py-3 text-lg rounded-xl font-bold shadow-lg transition-all"
        >
          {loadingPreview ? "⏳ Generating..." : "🎞️ Generate AI Preview"}
        </button>
      </div>

      {/* Preview Output */}
      <div className="mt-10 flex justify-center">
        {loadingPreview ? (
          <div className="text-center text-gray-300 animate-pulse text-xl">
            ⏳ AI is generating your preview...
          </div>
        ) : previewUrl ? (
          <video
            src={previewUrl}
            controls
            className="rounded-xl max-w-full w-[500px] shadow-2xl border border-gray-700"
          />
        ) : null}
      </div>
    </div>
  );
}

export default Editor;
