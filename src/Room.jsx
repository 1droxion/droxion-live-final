import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const SIGNAL_SERVER = "wss://winkly-signal-server.onrender.com"; // ✅ Your live WebSocket signaling server

export default function Room() {
  const [search] = useSearchParams();
  const gender = search.get("gender") || "any";
  const country = search.get("country") || "any";

  const [message, setMessage] = useState("Waiting for match...");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [loading, setLoading] = useState(true);

  const localRef = useRef();
  const remoteRef = useRef();
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const partnerId = useRef(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localRef.current) {
        localRef.current.srcObject = stream;
      }

      socketRef.current = new WebSocket(SIGNAL_SERVER);

      socketRef.current.onopen = () => {
        socketRef.current.send(JSON.stringify({ type: "join", gender, country }));
      };

      socketRef.current.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "matched") {
          partnerId.current = data.partnerId;
          createPeer(true);
          setMessage("✅ Connected to user " + data.partnerId);
          setLoading(false);
        }

        if (data.type === "signal") {
          if (!peerRef.current) createPeer(false);
          await peerRef.current.signal(data.data);
        }

        if (data.type === "nomatch") {
          setMessage("❌ No users available, showing fake user...");
          setLoading(false);
        }
      };
    } catch (err) {
      console.error("❌ Camera/mic permission denied:", err);
      setMessage("🚫 Cannot access camera or mic.");
    }
  };

  const createPeer = (initiator) => {
    const SimplePeer = require("simple-peer");
    peerRef.current = new SimplePeer({
      initiator,
      trickle: false,
      stream: localStream.current
    });

    peerRef.current.on("signal", (data) => {
      socketRef.current.send(JSON.stringify({
        type: "signal",
        target: partnerId.current,
        data
      }));
    });

    peerRef.current.on("stream", (stream) => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = stream;
      }
    });

    peerRef.current.on("close", () => {
      setMessage("🔄 Peer disconnected.");
    });
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { sender: "you", text: input.trim() }]);
    setInput("");
  };

  const toggleCamera = () => {
    localStream.current.getVideoTracks().forEach((track) => (track.enabled = !cameraOn));
    setCameraOn(!cameraOn);
  };

  const toggleMic = () => {
    localStream.current.getAudioTracks().forEach((track) => (track.enabled = !micOn));
    setMicOn(!micOn);
  };

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", color: "#ffd700" }}>Winkly Live ★</h1>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={toggleCamera} style={{ padding: 10, background: cameraOn ? "#ffd700" : "#555", borderRadius: 10 }}>🎥 {cameraOn ? "Camera On" : "Camera Off"}</button>
        <button onClick={toggleMic} style={{ padding: 10, background: micOn ? "#ffd700" : "#555", borderRadius: 10 }}>🎤 {micOn ? "Mic On" : "Mic Off"}</button>
      </div>

      {loading ? (
        <p style={{ color: "#ccc" }}>🔍 Matching with someone...</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
            <video ref={localRef} autoPlay muted playsInline style={{ width: 240, height: 180, borderRadius: 12, border: "2px solid #ffd700" }} />
            <video ref={remoteRef} autoPlay playsInline style={{ width: 240, height: 180, borderRadius: 12, border: "2px solid #ffcc70" }} />
          </div>
          <div style={{ marginTop: 20 }}>
            <p style={{ fontWeight: "bold", color: "#aaa" }}>{message}</p>
          </div>
          <div style={{
            marginTop: 20,
            background: "#111",
            padding: "10px 16px",
            borderRadius: 12,
            width: "100%",
            maxWidth: 500,
            marginInline: "auto"
          }}>
            <div style={{ minHeight: 80, marginBottom: 10, color: "#ccc", fontSize: "0.95rem", textAlign: "left" }}>
              {messages.map((msg, i) => (
                <div key={i}><strong>{msg.sender}:</strong> {msg.text}</div>
              ))}
            </div>
            <div style={{ display: "flex" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type message..."
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", outline: "none" }}
              />
              <button
                onClick={handleSend}
                style={{ marginLeft: 8, padding: "8px 16px", background: "#ffd700", color: "#000", fontWeight: "bold", borderRadius: 8, border: "none" }}>
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
