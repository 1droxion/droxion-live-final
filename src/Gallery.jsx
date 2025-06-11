import React, { useEffect, useState } from "react";
import axios from "axios";

function Gallery() {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/public-gallery`)
      .then((res) => {
        setFiles(res.data || []);
      })
      .catch((err) => {
        console.error("❌ Gallery Load Error:", err);
        setFiles([]);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-gray-900 text-white px-4 py-10">
      <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-500 text-center mb-12 animate-fade-in">
        🌐 Public Gallery
      </h1>

      {files.length === 0 ? (
        <p className="text-center text-gray-400">No files yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto animate-slide-up">
          {files.map((file, i) => {
            const isVideo = file.endsWith(".mp4");
            const src = `${import.meta.env.VITE_BACKEND_URL}/public/${file}`;
            return (
              <div
                key={i}
                className="bg-[#111] border border-gray-800 rounded-xl p-3 shadow-xl"
              >
                {isVideo ? (
                  <video
                    src={src}
                    controls
                    className="rounded-xl w-full h-auto max-h-[320px] object-cover"
                  />
                ) : (
                  <img
                    src={src}
                    alt={`Generated ${i}`}
                    className="rounded-xl w-full h-auto max-h-[320px] object-cover"
                  />
                )}
                <div className="text-xs text-gray-400 mt-2 truncate">{file}</div>
                <a
                  href={src}
                  download
                  className="text-blue-400 text-sm hover:underline mt-1 inline-block"
                >
                  ⬇️ Download
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Gallery;
