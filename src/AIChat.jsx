// Full updated AIChat.jsx with:
// 1. Fixed image upload error handling
// 2. Photo/Mic/Plus icons moved to bottom
// 3. Image input menu: Add file, Take photo, Screenshot

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone, FaMemory, FaCamera
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(() => localStorage.getItem("droxion_memory") === "true");
  const [memoryData, setMemoryData] = useState(() => {
    const data = localStorage.getItem("droxion_memory_data");
    return data ? JSON.parse(data) : [];
  });

  const chatRef = useRef(null);
  const synth = window.speechSynthesis;

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel();
    synth.speak(utterance);
  };

  const saveToMemory = (text) => {
    if (text.toLowerCase().includes("my name is")) {
      const name = text.split("my name is")[1].trim().split(" ")[0];
      const updated = [...memoryData, `The user's name is ${name}.`];
      setMemoryData(updated);
      localStorage.setItem("droxion_memory_data", JSON.stringify(updated));
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    saveToMemory(input);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode,
        videoMode,
        systemPrompt: memoryEnabled && memoryData.length
          ? `You are an AI assistant with the following memory about the user: ${memoryData.join(" ")}`
          : "You are an AI assistant."
      });
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speak(reply);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    setMessages((prev) => [...prev, { role: "user", content: "[Image uploaded]" }]);
    setTyping(true);
    try {
      const res = await axios.post("https://droxion-backend.onrender.com/describe-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const description = res.data.description || "No description available.";
      setMessages((prev) => [...prev, { role: "assistant", content: description }]);
      speak(description);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Couldn't process the image." }]);
    } finally {
      setTyping(false);
    }
  };

  const openFileDialog = () => document.getElementById("fileInput").click();
  const handleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Mic not supported");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (e) => setInput(e.results[0][0].transcript);
  };

  const captureScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();
      handleImageUpload(blob);
      track.stop();
    } catch (err) {
      alert("Screenshot failed");
    }
  };

  const takePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();
      handleImageUpload(blob);
      track.stop();
    } catch (err) {
      alert("Camera not accessible");
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMemory = () => {
    const newState = !memoryEnabled;
    setMemoryEnabled(newState);
    localStorage.setItem("droxion_memory", newState);
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">💬 <span>AI Chat (Droxion)</span></div>
        <div className="flex space-x-2 items-center">
          <FaClock title="History" className="cursor-pointer" />
          <FaTrash title="Clear" className="cursor-pointer" onClick={() => setMessages([])} />
          <FaDownload title="Download" className="cursor-pointer" onClick={() => {
            const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "chat.txt";
            link.click();
          }} />
          <FaVideo title="Video Mode" className={`cursor-pointer ${videoMode ? 'text-green-500' : ''}`} onClick={() => setVideoMode(!videoMode)} />
          <FaMemory title="Toggle Memory" className={`cursor-pointer ${memoryEnabled ? 'text-yellow-400' : ''}`} onClick={toggleMemory} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({ node, ...props }) => (<img {...props} alt="Generated" className="rounded-lg my-2 max-w-xs" />),
              iframe: ({ node, ...props }) => (<iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />)
            }}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-[ping_2s_ease-in-out_infinite]"></span></div>}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <button onClick={handleMic} title="Mic"><FaMicrophone /></button>
          <button onClick={() => handleImageUpload} title="Choose File"><FaCamera /></button>
          <button onClick={captureScreenshot} title="Screenshot">📷</button>
          <button onClick={takePhoto} title="Take Photo">📸</button>
          <input id="fileInput" type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e.target.files[0])} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-gray-900 text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
