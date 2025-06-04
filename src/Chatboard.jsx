import React, { useState } from "react";
import axios from "axios";

function Chatboard() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      const res = await axios.post("https://droxion-backend1.onrender.com/chat", {
        message,
      });
      setResponse(res.data.reply);
    } catch (err) {
      console.error("❌ Chat Error", err);
      setResponse("⚠️ Failed to respond. Try again.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4 text-green-400">💬 AI Chatboard</h2>
      <textarea
        rows="3"
        className="w-full p-3 rounded border bg-gray-900 text-white"
        placeholder="Type your message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        onClick={handleSend}
        className="mt-2 bg-green-500 px-4 py-2 rounded text-white hover:bg-green-600"
      >
        Send
      </button>
      {response && (
        <div className="mt-4 bg-gray-800 text-white p-4 rounded shadow">{response}</div>
      )}
    </div>
  );
}

export default Chatboard;
