import {
  issueScanToken,
  readScanToken,
  readBody,
  setCors,
  validInstallId
} from "../server/fit-security.js";

const FREE_SCANS = 3;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = readBody(req);
  const installId = String(body.installId || "").trim();
  if (!validInstallId(installId)) {
    return res.status(400).json({ error: "Invalid install identifier." });
  }

  const current = readScanToken(body.token, installId);
  const used = Math.max(0, Number(current?.used || 0));
  const token = issueScanToken(installId, used);

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    token,
    freeRemaining: Math.max(0, FREE_SCANS - used)
  });
}
