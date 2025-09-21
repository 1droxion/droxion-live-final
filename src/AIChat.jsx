// src/AIChat.jsx — Droxion (smart: prompt → Auto choose Remix/Inpaint/BG)
// - Adds "Auto (smart)" mode that calls /smart-image
// - Still supports manual Remix / Inpaint / BG
// - Robust to backend response shapes: {images:[]} or {outputs:[]}
// - Clear errors for Replicate 4xx/5xx
// - Reliable inpaint mask drawing (mobile + desktop)

import React, { useRef, useState, useEffect } from "react";
import axios from "axios";

// === change this if needed ===
const API_BASE = "https://droxion-backend.onrender.com";

export default function AIChat() {
  // chat-ish store (simple)
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Upload a photo, set Mode to Auto, type what you want (e.g., “Studio Ghibli forest background” or “remove logo” or “Pixar-style portrait”), then Create." }
  ]);

  // editor state
  const [mode, setMode] = useState("auto"); // auto | remix | inpaint | bg
  const [styleStrength, setStyleStrength] = useState(0.6); // remix-only (manual)
  const [prompt, setPrompt] = useState("");
  const [imageB64, setImageB64] = useState(null);
  const [maskB64, setMaskB64] = useState(null);
  const [loading, setLoading] = useState(false);

  // file input
  const fileRef = useRef(null);
  const lastFileObj = useRef(null); // keep original File too (useful later)

  function pickFile() {
    fileRef.current?.click();
  }

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
    const b64 = await toBase64(f);
    setImageB64(b64);
    // reset mask for new image
    setMaskB64(null);
  }

  // --- Inpaint mask canvas ---
  function MaskCanvas({ base, onChange }) {
    const cRef = useRef(null);
    const [drawing, setDrawing] = useState(false);

    // draw black base (keep) sized to the displayed image
    useEffect(() => {
      if (!base) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
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

    function drawAt(clientX, clientY) {
      const c = cRef.current;
      const rect = c.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "white"; // white = edit area
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      onChange(c.toDataURL("image/png"));
    }

    function onMouseDown(e) {
      e.preventDefault();
      setDrawing(true);
      drawAt(e.clientX, e.clientY);
    }
    function onMouseMove(e) {
      if (!drawing) return;
      drawAt(e.clientX, e.clientY);
    }
    function onMouseUp() {
      setDrawing(false);
    }

    function onTouchStart(e) {
      setDrawing(true);
      const t = e.touches[0];
      drawAt(t.clientX, t.clientY);
    }
    function onTouchMove(e) {
      if (!drawing) return;
      const t = e.touches[0];
      drawAt(t.clientX, t.clientY);
    }
    function onTouchEnd() {
      setDrawing(false);
    }

    return (
      <div className="block">
        <label className="lbl">Mask (white = change, black = keep)</label>
        <canvas
          ref={cRef}
          className="mask"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        <p className="hint">Brush over the parts you want to modify.</p>
      </div>
    );
  }

  // helper: normalize backend response
  function extractUrls(data) {
    // supports {images:[...]} or {outputs:[...]} or plain array
    if (!data) return [];
    if (Array.isArray(data)) return data.map(String);
    if (Array.isArray(data.images)) return data.images.map(String);
    if (Array.isArray(data.outputs)) return data.outputs.map(String);
    // some smart endpoints also return subject/background — include if present
    const merged = [];
    if (Array.isArray(data.subject_png)) merged.push(...data.subject_png.map(String));
    if (Array.isArray(data.background)) merged.push(...data.background.map(String));
    return merged;
  }

  // pretty error
  function showErr(err) {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.message ||
      "Something went wrong.";
    alert(msg);
  }

  // --- submit ---
  async function createImage() {
    if (!imageB64) return alert("Please upload an image first.");
    if (!prompt.trim() && mode !== "bg") return alert("Please write a prompt.");

    try {
      setLoading(true);

      // Auto goes to /smart-image (server decides best path)
      let path = mode === "auto" ? "/smart-image" : "/remix-image";
      let payload = { image_base64: imageB64, prompt };

      if (mode === "remix") {
        payload.style_strength = styleStrength;
      } else if (mode === "inpaint") {
        path = "/inpaint-image";
        if (!maskB64) return alert("Please paint a mask (white = change).");
        payload.mask_base64 = maskB64;
      } else if (mode === "bg") {
        path = "/bg-swap";
      } else if (mode === "auto") {
        // help the planner if user provided a mask
        if (maskB64) payload.mask_base64 = maskB64;
      }

      const { data } = await axios.post(`${API_BASE}${path}`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 120000
      });

      const urls = extractUrls(data);
      const ok = data?.ok !== false && urls.length > 0;
      const usedMode = data?.mode || mode;

      if (!ok) throw new Error(data?.error || "No image returned.");

      const imgs = urls.map((u, i) => ({ u, i }));
      setMessages((m) => [
        ...m,
        { role: "user", text: `Mode: ${usedMode} — "${prompt || "(no prompt)"}"` },
        { role: "assistant", images: imgs }
      ]);
    } catch (err) {
      showErr(err);
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setPrompt("");
    setImageB64(null);
    setMaskB64(null);
    if (fileRef.current) fileRef.current.value = "";
    lastFileObj.current = null;
  }

  // quick presets (optional)
  const presets = [
    ["Cinematic", "cinematic film still, warm key light, soft bokeh background, 85mm lens, keep face identity"],
    ["Pixar 3D",   "Pixar-style 3D portrait, soft rim light, smooth shading, glossy jacket, keep face identity"],
    ["Ghibli",     "Studio Ghibli watercolor forest background, pastel colors, sunlight through trees, gentle film grain, keep face identity"],
    ["Cyberpunk",  "futuristic cyberpunk portrait, Tokyo neon lights, blue and magenta glow, cinematic atmosphere, keep face identity"]
  ];

  return (
    <div className="wrap">
      {/* Header */}
      <div className="topbar">
        <div className="brand">Droxion — Image Edit</div>
        <div className="spacer" />
        <button className="btn" onClick={clearAll} title="Clear">Clear</button>
      </div>

      {/* Editor */}
      <div className="editor">
        <div className="row">
          <div className="col">
            <div className="block">
              <label className="lbl">1) Upload Image</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              <button className="btn" onClick={pickFile}>Choose Image</button>
            </div>

            {imageB64 && (
              <div className="block">
                <img src={imageB64} alt="base" className="preview" />
              </div>
            )}
          </div>

          <div className="col">
            <div className="block">
              <label className="lbl">2) Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="select">
                <option value="auto">Auto (smart)</option>
                <option value="remix">Remix (keep face/style-lock)</option>
                <option value="inpaint">Inpaint (mask areas to change)</option>
                <option value="bg">Background Swap</option>
              </select>
            </div>

            {mode === "remix" && (
              <div className="block">
                <label className="lbl">Style Strength: {styleStrength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={styleStrength}
                  onChange={(e) => setStyleStrength(parseFloat(e.target.value))}
                />
                <p className="hint">Higher = more stylized, lower = closer to original.</p>
              </div>
            )}

            {/* Presets */}
            <div className="block" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              {presets.map(([label, txt]) => (
                <button key={label} className="btn" onClick={(e)=>{ e.preventDefault(); setPrompt(txt); }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="block">
              <label className="lbl">3) Prompt</label>
              <textarea
                className="ta"
                placeholder={
                  mode === "bg"
                    ? "e.g., beach at golden hour, cinematic lighting"
                    : "e.g., Pixar-style portrait, soft studio lights, 85mm, f1.8"
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {mode === "inpaint" && imageB64 && (
              <MaskCanvas base={imageB64} onChange={setMaskB64} />
            )}

            <div className="block">
              <button className="btn primary" onClick={createImage} disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages / Results */}
      <div className="chat">
        {messages.map((m, idx) => (
          <div key={idx} className={`msg ${m.role}`}>
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

      {/* tiny styles to make it usable without touching your CSS yet */}
      <style>{`
        .wrap { color: #eaeaea; background:#0a0a0a; min-height:100vh; display:flex; flex-direction:column; }
        .topbar { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #222; position:sticky; top:0; background:#0a0a0a; z-index:5;}
        .brand { font-weight:700; letter-spacing:.3px; }
        .spacer { flex:1; }
        .editor { padding:16px; border-bottom:1px solid #222; }
        .row { display:flex; gap:16px; flex-wrap:wrap; }
        .col { flex:1 1 320px; min-width:280px; }
        .block { margin-bottom:12px; }
        .lbl { display:block; font-size:13px; opacity:.8; margin-bottom:6px; }
        .btn { background:#1a1a1a; border:1px solid #333; color:#fff; height:36px; padding:0 12px; border-radius:8px; cursor:pointer; }
        .btn.primary { border-color:#555; background:#111; font-weight:600; }
        .select, .ta, input[type="range"] { width:100%; }
        .select { background:#111; color:#fff; border:1px solid #333; height:36px; border-radius:8px; padding:0 8px; }
        .ta { min-height:84px; background:#111; color:#fff; border:1px solid #333; border-radius:10px; padding:10px; resize:vertical;}
        .preview { max-width:100%; height:auto; border-radius:10px; border:1px solid #222; display:block; }
        .mask { width:100%; max-width:100%; border:1px dashed #444; border-radius:10px; touch-action:none; background:#000; }
        .hint { opacity:.7; font-size:12px; margin-top:6px; }
        .chat { padding:16px; display:flex; flex-direction:column; gap:14px; }
        .msg.user { align-self:flex-end; max-width:90%; }
        .msg.assistant { align-self:flex-start; max-width:100%; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; margin-top:8px; }
        .imgwrap { display:block; border:1px solid #222; border-radius:10px; overflow:hidden; background:#111; }
        .imgwrap img { width:100%; height:auto; display:block; }
        .hidden { display:none; }
        @media (max-width:600px){ .row{ gap:10px; } }
      `}</style>
    </div>
  );
}