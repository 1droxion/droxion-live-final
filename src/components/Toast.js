import React from "react";

function Toast({ message, onClose }) {
  return (
    <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded shadow-lg flex items-center gap-3 animate-slide-in">
      <span className="text-lg">✅</span>
      <p className="flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-white hover:text-gray-200 text-sm font-bold"
      >
        ✖
      </button>
    </div>
  );
}

export default Toast;
