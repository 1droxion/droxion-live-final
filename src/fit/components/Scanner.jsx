import { useRef, useState } from "react";
import { Camera, ChevronLeft, Image as ImageIcon, Plus, RotateCcw, ScanLine } from "lucide-react";
import { analyzeFood } from "../api.js";
import { compressImage, makeThumbnail } from "../image.js";
import { trackEvent } from "../analytics.js";

export default function Scanner({ freeRemaining, onClose, onPaywall, onSave }) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const [image, setImage] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  async function handleFile(file, input) {
    if (input) input.value = "";
    if (!file) return;
    setError("");
    setAnalysis(null);
    setLoading(true);
    trackEvent("scan_started");

    try {
      const prepared = await compressImage(file);
      setImage(prepared);
      const payload = await analyzeFood(prepared, hint);
      setAnalysis(payload.analysis);
      trackEvent("scan_completed", {
        confidence: payload.analysis?.confidence || "unknown",
        pro: Boolean(payload.pro)
      });
    } catch (err) {
      if (err?.paywall || err?.code === "PRO_REQUIRED") {
        trackEvent("paywall_viewed", { source: "scan_limit" });
        onPaywall();
        return;
      }
      setError(err?.message || "Could not analyze this meal.");
      trackEvent("scan_failed", { code: err?.code || "unknown" });
    } finally {
      setLoading(false);
    }
  }

  function patch(field, value) {
    setAnalysis(current => current ? { ...current, [field]: value } : current);
  }

  async function save() {
    if (!analysis) return;
    const thumbnail = image ? await makeThumbnail(image).catch(() => "") : "";
    onSave({ ...analysis, image: thumbnail });
    trackEvent("meal_saved", { calories: Number(analysis.calories || 0), protein: Number(analysis.protein || 0) });
  }

  function reset() {
    setImage("");
    setAnalysis(null);
    setError("");
  }

  return (
    <div className="fitScanner" role="dialog" aria-modal="true" aria-label="Scan a meal">
      <header className="fitScannerHead">
        <button type="button" className="fitIconButton" onClick={onClose} aria-label="Close scanner"><ChevronLeft size={22} /></button>
        <div className="fitBrand compact">
          <div className="fitBrandMark"><ScanLine size={18} strokeWidth={2.5} /></div>
          <strong>Droxion Fit</strong>
        </div>
        <span className="fitScanQuota">{freeRemaining} free</span>
      </header>

      {!image && (
        <section className="fitScannerStart">
          <div className="fitCameraOrb"><Camera size={42} /></div>
          <h2>Scan your meal</h2>
          <p>Take one clear photo. Droxion Fit will estimate the food, portions, calories and macros.</p>

          <label className="fitInputLabel">
            <span>Optional portion detail</span>
            <input
              value={hint}
              onChange={event => setHint(event.target.value)}
              placeholder="Example: chicken was 6 oz"
              autoCapitalize="sentences"
            />
          </label>

          <div className="fitScannerActions">
            <button type="button" className="fitPrimary" onClick={() => cameraRef.current?.click()}>
              <Camera size={20} /> Take photo
            </button>
            <button type="button" className="fitSecondary" onClick={() => libraryRef.current?.click()}>
              <ImageIcon size={20} /> Choose photo
            </button>
          </div>

          <input
            ref={cameraRef}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={event => handleFile(event.target.files?.[0], event.target)}
          />
          <input
            ref={libraryRef}
            hidden
            type="file"
            accept="image/*"
            onChange={event => handleFile(event.target.files?.[0], event.target)}
          />
          <small>AI nutrition values are estimates. Review the result before saving.</small>
        </section>
      )}

      {image && (
        <section className="fitScanResult">
          <div className="fitMealImage">
            <img src={image} alt="Meal selected for analysis" />
            {loading && (
              <div className="fitAnalyzing">
                <ScanLine size={30} />
                <strong>Analyzing your meal…</strong>
                <span>Identifying foods and estimating portions</span>
              </div>
            )}
          </div>

          {error && (
            <div className="fitError">
              <strong>We couldn’t scan that photo</strong>
              <span>{error}</span>
              <button type="button" className="fitSecondary" onClick={reset}>Try another photo</button>
            </div>
          )}

          {analysis && (
            <div className="fitAnalysisCard">
              <div className="fitAnalysisTitle">
                <div>
                  <span className="fitEyebrow">{analysis.confidence || "Estimated"}</span>
                  <input className="fitMealName" value={analysis.name || ""} onChange={event => patch("name", event.target.value)} />
                </div>
                <button type="button" className="fitIconButton" onClick={reset} aria-label="Scan another meal"><RotateCcw size={18} /></button>
              </div>

              {Array.isArray(analysis.items) && analysis.items.length > 0 && (
                <div className="fitDetected">{analysis.items.join(" · ")}</div>
              )}

              <div className="fitMacroEdit">
                {[
                  ["calories", "Calories", ""],
                  ["protein", "Protein", "g"],
                  ["carbs", "Carbs", "g"],
                  ["fat", "Fat", "g"]
                ].map(([field, label, unit]) => (
                  <label key={field}>
                    <span>{label}</span>
                    <div>
                      <input
                        inputMode="decimal"
                        type="number"
                        min="0"
                        value={analysis[field] ?? 0}
                        onChange={event => patch(field, event.target.value)}
                      />
                      <small>{unit}</small>
                    </div>
                  </label>
                ))}
              </div>

              {analysis.note && <p className="fitEstimateNote">{analysis.note}</p>}
              <p className="fitEstimateNote">Photo-based nutrition is approximate. Correct portions if anything looks wrong.</p>
              <button type="button" className="fitPrimary fitWide" onClick={save}><Plus size={19} /> Add to today</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
