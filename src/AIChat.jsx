// src/AIChat.jsx — Droxion (Image Studio: Prompt + Upload/Edit)
// - NEW: "Source" tabs (Create from Prompt | Upload & Edit)
// - Prompt-only flow calls POST /generate-image (size + steps + guidance controls)
// - Upload/Edit keeps Remix, Inpaint (mask), Background Swap (subject+bg+composite)
// - Robust response handling (images[] | outputs[] | bg-swap pieces)

import React, { useRef, useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://droxion-backend.onrender.com";

export default function AIChat() {
  // ---- Chat feed
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Choose a source:\n" +
        "• Create from Prompt → type a prompt and generate images.\n" +
        "• Upload & Edit → upload an image, write a prompt, and pick Remix / Inpaint / Background Swap."
    }
  ]);

  // ---- Global UI
  const [loading, setLoading] = useState(false);

  // ---- Source tabs: "prompt" | "upload"
  const [source, setSource] = useState("prompt");

  // ---- Prompt-only controls
  const [prompt, setPrompt] = useState("");
  const [sizePreset, setSizePreset] = useState("square"); // square | portrait | landscape
  const [steps, setSteps] = useState(20);
  const [guidance, setGuidance] = useState(4.0);
  const [num, setNum] = useState(1);

  // ---- Upload/Edit controls
  const [mode, setMode] = useState("remix"); // remix | inpaint | bg
  const [styleStrength, setStyleStrength] = useState(0.6); // remix-only
  const [imageB64, setImageB64] = useState(null);
  const [maskB64, setMaskB64] = useState(null);

  const fileRef = useRef(null);
  const lastFileObj = useRef(null);

  // ---------- helpers ----------
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
    const b64 = await toBase64(f);
    setImageB64(b64);
    setMaskB64(null);
  }

  // -------- Inpaint mask canvas --------
  function MaskCanvas({ base, onChange }) {
    const cRef = useRef(null);
    const [drawing, setDrawing] = useState(false);

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
      ctx.fillStyle = "white"; // white = change
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      onChange(c.toDataURL("image/png"));
    }

    function onMouseDown(e) { e.preventDefault(); setDrawing(true); drawAt(e.clientX, e.clientY); }
    function onMouseMove(e) { if (drawing) drawAt(e.clientX, e.clientY); }
    function onMouseUp() { setDrawing(false); }
    function onTouchStart(e) { setDrawing(true); const t = e.touches[0]; drawAt(t.clientX, t.clientY); }
    function onTouchMove(e) { if (!drawing) return; const t = e.touches[0]; drawAt(t.clientX, t.clientY); }
    function onTouchEnd() { setDrawing(false); }

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
        <p className="hint">Brush over areas you want to modify.</p>
      </div>
    );
  }

  // -------- Compose quick preview for bg-swap --------
  function Composite({ subjectUrl, backgroundUrl }) {
    const canvasRef = useRef(null);

    useEffect(() => {
      if (!subjectUrl || !backgroundUrl) return;
      const c = canvasRef.current;
      const ctx = c.getContext("2d");

      const bg = new Image();
      const fg = new Image();
      bg.crossOrigin = "anonymous";
      fg.crossOrigin = "anonymous";

      bg.onload = () => {
        const maxW = Math.min(900, window.innerWidth - 24);
        const scale = Math.min(1, maxW / bg.width);
        c.width = Math.round(bg.width * scale);
        c.height = Math.round(bg.height * scale);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(bg, 0, 0, c.width, c.height);

        fg.onload = () => {
          const targetW = c.width * 0.55;
          const ratio = targetW / fg.width;
          const targetH = fg.height * ratio;
          const x = (c.width - targetW) / 2;
          const y = c.height * 0.4 - targetH / 2;
          ctx.drawImage(fg, x, y, targetW, targetH);
        };
        fg.src = subjectUrl;
      };
      bg.src = backgroundUrl;
    }, [subjectUrl, backgroundUrl]);

    return (
      <div className="block">
        <label className="lbl">Quick Composite Preview</label>
        <canvas ref={canvasRef} className="preview" />
      </div>
    );
  }

  // -------- normalize backend responses --------
  function extractUrls(data) {
    if (!data) return [];

    // Remix / Inpaint / Text2Img
    if (Array.isArray(data)) return data.map(String);
    if (Array.isArray(data.images)) return data.images.map(String);
    if (Array.isArray(data.outputs)) return data.outputs.map(String);

    // Background Swap
    const subj = Array.isArray(data.subject_png) ? data.subject_png.map(String) : [];
    const bg = Array.isArray(data.background) ? data.background.map(String) : [];
    if (subj.length || bg.length) return [...subj, ...bg];

    // Error passthrough
    if (data.detail && typeof data.detail === "string") return [data.detail];

    return [];
  }

  function showErr(err) {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.message ||
      "Something went wrong.";
    alert(msg);
  }

  // ---------- ACTIONS ----------
  function dimsFromPreset(preset) {
    if (preset === "portrait") return { width: 1024, height: 1365 };
    if (preset === "landscape") return { width: 1365, height: 1024 };
    return { width: 1024, height: 1024 }; // square
  }

  async function goPromptToImage() {
    if (!prompt.trim()) return alert("Please write a prompt.");
    const { width, height } = dimsFromPreset(sizePreset);

    try {
      setLoading(true);
      const { data } = await axios.post(
        `${API_BASE}/generate-image`,
        {
          prompt,
          width,
          height,
          steps: Number(steps),
          guidance: Number(guidance),
          num_outputs: Number(num)
        },
        { headers: { "Content-Type": "application/json" }, timeout: 120000 }
      );

      const urls = extractUrls(data);
      const ok = data?.ok !== false && urls.length > 0;
      if (!ok) throw new Error(data?.error || "No image returned.");

      const imgs = urls.map((u, i) => ({ u, i }));
      setMessages((m) => [
        ...m,
        { role: "user", text: `Create from Prompt — "${prompt}"` },
        { role: "assistant", images: imgs }
      ]);
    } catch (err) {
      showErr(err);
    } finally {
      setLoading(false);
    }
  }

  async function goUploadEdit() {
    if (!imageB64) return alert("Please upload an image first.");
    if (!prompt.trim() && mode !== "bg") return alert("Please write a prompt.");

    try {
      setLoading(true);

      let path = "/remix-image";
      let payload = { image_base64: imageB64, prompt };

      if (mode === "remix") {
        payload.style_strength = styleStrength;
        payload.image_guidance_scale = Math.max(1, styleStrength * 10);
      } else if (mode === "inpaint") {
        path = "/inpaint-image";
        if (!maskB64) return alert("Please paint a mask (white = change).");
        payload.mask_base64 = maskB64;
      } else if (mode === "bg") {
        path = "/bg-swap";
      }

      const { data } = await axios.post(`${API_BASE}${path}`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 120000
      });

      const urls = extractUrls(data);
      const ok = data?.ok !== false && urls.length > 0;
      if (!ok) throw new Error(data?.error || "No image returned.");

      const imgs = urls.map((u, i) => ({ u, i }));
      setMessages((m) => [
        ...m,
        { role: "user", text: `Mode: ${mode} — "${prompt || "(no prompt)"}"` },
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

  // ---------- UI ----------
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">Droxion — Image Studio</div>
        <div className="spacer" />
        <button className="btn ghost" onClick={clearAll} title="Clear">Clear</button>
      </div>

      {/* Source Tabs */}
      <div className="tabs">
        <button
          className={`tab ${source === "prompt" ? "active" : ""}`}
          onClick={() => setSource("prompt")}
        >
          Create from Prompt
        </button>
        <button
          className={`tab ${source === "upload" ? "active" : ""}`}
          onClick={() => setSource("upload")}
        >
          Upload & Edit
        </button>
      </div>

      {/* Panels */}
      {source === "prompt" ? (
        <div className="panel">
          <div className="row">
            <div className="col">
              <div className="block">
                <label className="lbl">Prompt</label>
                <textarea
                  className="ta"
                  placeholder="e.g., cinematic golden tea shop counter with steam, warm rim light, 35mm, shallow depth of field"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </div>
            <div className="col">
              <div className="block">
                <label className="lbl">Size</label>
                <select
                  className="select"
                  value={sizePreset}
                  onChange={(e) => setSizePreset(e.target.value)}
                >
                  <option value="square">Square (1024 × 1024)</option>
                  <option value="portrait">Portrait (1024 × 1365)</option>
                  <option value="landscape">Landscape (1365 × 1024)</option>
                </select>
              </div>

              <div className="grid2">
                <div className="block">
                  <label className="lbl">Steps: {steps}</label>
                  <input
                    type="range" min="8" max="40" step="1"
                    value={steps}
                    onChange={(e) => setSteps(parseInt(e.target.value))}
                  />
                </div>
                <div className="block">
                  <label className="lbl">Guidance: {guidance.toFixed(1)}</label>
                  <input
                    type="range" min="1" max="12" step="0.5"
                    value={guidance}
                    onChange={(e) => setGuidance(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="block">
                <label className="lbl">Number of Images</label>
                <select className="select" value={num} onChange={(e) => setNum(parseInt(e.target.value))}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>

              <div className="block">
                <button className="btn primary" onClick={goPromptToImage} disabled={loading}>
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="row">
            <div className="col">
              <div className="block">
                <label className="lbl">Upload Image</label>
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
                <label className="lbl">Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="select">
                  <option value="remix">Remix (style/lighting)</option>
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

              <div className="block">
                <label className="lbl">Prompt</label>
                <textarea
                  className="ta"
                  placeholder={
                    mode === "bg"
                      ? "e.g., Studio Ghibli forest background, sunlight through trees"
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
                <button className="btn primary" onClick={goUploadEdit} disabled={loading}>
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            {m.subjectUrl && m.backgroundUrl && (
              <Composite subjectUrl={m.subjectUrl} backgroundUrl={m.backgroundUrl} />
            )}
          </div>
        ))}
      </div>

      {/* Styles */}
      <style>{`
        .wrap { color:#eaeaea; background:#0a0a0a; min-height:100vh; display:flex; flex-direction:column; }
        .topbar { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #1a1a1a; position:sticky; top:0; background:#0a0a0a; z-index:5;}
        .brand { font-weight:700; letter-spacing:.3px; }
        .spacer { flex:1; }

        .tabs { display:flex; gap:8px; padding:12px 16px; border-bottom:1px solid #1a1a1a; }
        .tab { background:#111; border:1px solid #2a2a2a; color:#ddd; padding:8px 12px; border-radius:999px; cursor:pointer; }
        .tab.active { background:#0e0e0e; border-color:#555; font-weight:700; }

        .panel { padding:16px; border-bottom:1px solid #111; }
        .row { display:flex; gap:16px; flex-wrap:wrap; }
        .col { flex:1 1 320px; min-width:280px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }

        .block { margin-bottom:12px; }
        .lbl { display:block; font-size:13px; opacity:.85; margin-bottom:6px; }
        .btn { background:#141414; border:1px solid #2b2b2b; color:#fff; height:36px; padding:0 12px; border-radius:10px; cursor:pointer; }
        .btn.primary { border-color:#4a4a4a; background:#0f0f0f; font-weight:700; }
        .btn.ghost { background:transparent; border:1px solid #222; }
        .select, .ta, input[type="range"] { width:100%; }
        .select { background:#0f0f0f; color:#fff; border:1px solid #2b2b2b; height:36px; border-radius:10px; padding:0 10px; }
        .ta { min-height:96px; background:#0f0f0f; color:#fff; border:1px solid #2b2b2b; border-radius:12px; padding:12px; resize:vertical;}
        .preview { max-width:100%; height:auto; border-radius:12px; border:1px solid #1b1b1b; display:block; }
        .mask { width:100%; max-width:100%; border:1px dashed #444; border-radius:12px; touch-action:none; background:#000; }
        .hint { opacity:.7; font-size:12px; margin-top:6px; }

        .chat { padding:16px; display:flex; flex-direction:column; gap:14px; }
        .msg.user { align-self:flex-end; max-width:90%; }
        .msg.assistant { align-self:flex-start; max-width:100%; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; margin-top:8px; }
        .imgwrap { display:block; border:1px solid #1b1b1b; border-radius:12px; overflow:hidden; background:#0f0f0f; }
        .imgwrap img { width:100%; height:auto; display:block; }
        .hidden { display:none; }

        @media (max-width:600px){ .row{ gap:10px; } .grid2{ grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}