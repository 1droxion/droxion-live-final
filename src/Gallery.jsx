import React, { useEffect, useState } from "react";

function Gallery() {
  const [images, setImages] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("droxion_image_history")) || [];
    const publicImages = stored.filter((img) => img.public);
    setImages(publicImages);
  }, []);

  const copyLink = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      alert("📋 Image link copied!");
    });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h1 className="text-4xl font-bold text-center text-green-400 mb-10">🌐 Public Image Gallery</h1>

      {images.length === 0 ? (
        <p className="text-center text-gray-400">No shared images yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {images.map((img, index) => (
            <div
              key={index}
              className="bg-[#1e293b] p-4 rounded-xl border border-gray-700 shadow-md"
            >
              <img
                src={img.url}
                alt="Generated"
                className="w-full h-48 object-cover rounded mb-3 shadow"
              />
              <p className="text-sm text-gray-300 truncate">📝 {img.prompt}</p>

              <div className="text-xs text-gray-400 mt-2 flex flex-wrap gap-2">
                {img.tags?.map((tag, i) => (
                  <span key={i} className="bg-gray-700 px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>

              <div className="text-xs flex justify-between mt-4 text-gray-400">
                <span>❤️ {img.likes || 0}</span>
                <span>⬇️ {img.downloads || 0}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={img.url}
                  download
                  className="flex-1 bg-green-600 hover:bg-green-700 text-sm text-white text-center py-2 rounded"
                >
                  ⬇️ Download
                </a>
                <button
                  onClick={() => copyLink(img.url)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-sm py-2 rounded"
                >
                  🔗 Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Gallery;
