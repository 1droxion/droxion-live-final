// src/AIChat.jsx — Droxion (Auto Mode + Smart Mode Detection)

import React, { useRef, useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://droxion-backend.onrender.com";

export default function AIChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Upload a photo, type a prompt, set mode to Auto (or choose manually), then Create." }
  ]);

  const [mode, setMode] = useState("auto"); // auto | remix | inpaint | bg
  const [styleStrength, setStyleStrength] = useState(0.6);
  const [prompt, setPrompt] = useState("");
  const [imageB64, setImageB64] = useState(null);
  const [maskB64, setMaskB64] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileRef = useRef(null);
  const lastFileObj = useRef(null);

  function pickFile() { fileRef.current?.click(); }
  function toBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  async function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    lastFileObj.current = f;
    setImageB64(await toBase64(f));
    setMaskB64(null);
  }

  // --- mask drawing ---
  function MaskCanvas({ base, onChange }) {
    const cRef = useRef(null);
    const [drawing, setDrawing] = useState(false);

    useEffect(() => {
      if (!base) return;
      const img = new Image();
      img.onload = () => {
        const c = cRef.current;
        const maxW = Math.min(900, window.innerWidth - 24);
        const scale = Math.min(1, maxW / img.width);
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, c.width, c.height);
        onChange(c.toDataURL("image/png"));
      };
      img.src = base;
    }, [base, onChange]);

    function draw(x, y) {
      const c = cRef.current, ctx = c.getContext("2d");
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      onChange(c.toDataURL("image/png"));
    }
    const handle = (clientX, clientY) => draw(clientX, clientY);

    return (
      <div className="block">
        <label className="lbl">Mask (white = change, black = keep)</label>
        <canvas
          ref={cRef}
          className="mask"
          onMouseDown={e => { setDrawing(true); handle(e.clientX, e.clientY); }}
          onMouseMove={e => drawing && handle(e.clientX, e.clientY)}
          onMouseUp={() => setDrawing(false)}
          onMouseLeave={() => setDrawing(false)}
          onTouchStart={e => { setDrawing(true); handle(e.touches[0].clientX, e.touches[0].clientY); }}
          onTouchMove={e => drawing && handle(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={() => setDrawing(false)}
        />
      </div>
    );
  }

  function extractUrls(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data.map(String);
    if (Array.isArray(data.images)) return data.images.map(String);
    if (Array.isArray(data.outputs)) return data.outputs.map(String);
    return [];
  }

  function detectMode(p) {
    if (mode !== "auto") return mode;
    const t = p.toLowerCase();
    if (t.includes("background") || t.includes("forest") || t.includes("scene")) return "bg";
    if (t.includes("remove") || t.includes("mask") || t.includes("shirt") || t.includes("fix")) return "inpaint";
    return "remix";
  }

  async function createImage() {
    if (!imageB64) return alert("Upload an image first.");
    if (!prompt.trim()) return alert("Please type a prompt.");

    try {
      setLoading(true);
      const chosenMode = detectMode(prompt);
      let path = "/remix-image";
      let payload = { image_base64: imageB64, prompt };

      if (chosenMode === "remix") {
        payload.style_strength = styleStrength;
      } else if (chosenMode === "inpaint") {
        path = "/inpaint-image";
        if (!maskB64) return alert("Please paint a mask first.");
        payload.mask_base64 = maskB64;
      } else if (chosenMode === "bg") {
        path = "/bg-swap";
      }

      const { data } = await axios.post(`${API_BASE}${path}`, payload, { headers: { "Content-Type": "application/json" }, timeout: 120000 });
      const urls = extractUrls(data);
      if (!urls.length) throw new Error(data?.error || "No image returned.");

      setMessages(m => [
        ...m,
        { role: "user", text: `Mode: ${chosenMode} — "${prompt}"` },
        { role: "assistant", images: urls.map((u, i) => ({ u, i })) }
      ]);
    } catch (err) {
      alert(err?.response?.data?.detail || err.message || "Error.");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setPrompt(""); setImageB64(null); setMaskB64(null);
    if (fileRef.current) fileRef.current.value = "";
    lastFileObj.current = null;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Droxion — Image Edit</div>
        <div className="spacer" />
        <button className="btn" onClick={clearAll}>Clear</button>
      </div>

      <div className="editor">
        <label className="lbl">1) Upload Image</label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange}/>
        <button className="btn" onClick={pickFile}>Choose Image</button>

        {imageB64 && <img src={imageB64} alt="base" className="preview" />}

        <div className="block">
          <label className="lbl">2) Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value)} className="select">
            <option value="auto">Auto (detect from prompt)</option>
            <option value="remix">Remix (keep face/style-lock)</option>
            <option value="inpaint">Inpaint (mask areas to change)</option>
            <option value="bg">Background Swap</option>
          </select>
        </div>

        {mode === "remix" && (
          <div className="block">
            <label className="lbl">Style Strength: {styleStrength.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.05" value={styleStrength} onChange={e => setStyleStrength(parseFloat(e.target.value))}/>
          </div>
        )}

        <div className="block">
          <label className="lbl">3) Prompt</label>
          <textarea className="ta" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe your edit..."/>
        </div>

        {(mode === "inpaint" || detectMode(prompt) === "inpaint") && imageB64 && <MaskCanvas base={imageB64} onChange={setMaskB64}/>}

        <button className="btn primary" onClick={createImage} disabled={loading}>{loading ? "Creating..." : "Create"}</button>
      </div>

      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text && <p>{m.text}</p>}
            {m.images && (
              <div className="grid">
                {m.images.map(({ u, i }) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="imgwrap">
                    <img src={u} alt={`result-${i}`} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .wrap { background:#0a0a0a; color:#fff; min-height:100vh; display:flex; flex-direction:column; }
        .topbar { display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid #222; }
        .brand { font-weight:700; }
        .editor { padding:16px; border-bottom:1px solid #222; }
        .preview { max-width:100%; border-radius:10px; margin-top:10px; }
        .select, .ta, input[type="range"] { width:100%; margin-top:6px; }
        .ta { min-height:80px; border-radius:10px; padding:8px; background:#111; color:#fff; border:1px solid #333; }
        .btn { background:#111; border:1px solid #333; color:#fff; border-radius:8px; padding:8px 12px; margin-top:8px; }
        .btn.primary { font-weight:600; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; margin-top:8px; }
        .imgwrap img { width:100%; display:block; }
        .mask { border:1px dashed #444; border-radius:10px; width:100%; touch-action:none; }
      `}</style>
    </div>
  );
}