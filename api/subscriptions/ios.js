import { X509Certificate, verify as verifySignature } from "node:crypto";
import {
  issueEntitlementToken,
  readBody,
  setCors,
  validInstallId
} from "../../server/fit-security.js";

const BUNDLE_ID = "com.droxion.live";
const PRODUCTS = new Set([
  "com.droxion.fit.pro.monthly",
  "com.droxion.fit.pro.yearly"
]);
const ROOT_URLS = [
  "https://www.apple.com/certificateauthority/AppleRootCA-G2.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
  "https://www.apple.com/appleca/AppleIncRootCertificate.cer"
];
const ROOT_FINGERPRINTS = new Set([
  "C2B9B042DD57830E7D117DAC55AC8AE19407D38E41D88F3215BC3A890444A050",
  "63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179",
  "B0B1730ECBC7FF4505142C49F1295E6EDA6BCAED7E2C68C5BE91B5A11001F024"
]);

let rootsPromise;

function b64url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - normalized.length % 4) : "";
  return Buffer.from(normalized + padding, "base64");
}

function jsonPart(value) {
  return JSON.parse(b64url(value).toString("utf8"));
}

function fingerprint(cert) {
  return String(cert.fingerprint256 || "").replace(/:/g, "").toUpperCase();
}

function validNow(cert) {
  const now = Date.now();
  return now >= Date.parse(cert.validFrom) && now <= Date.parse(cert.validTo);
}

async function roots() {
  if (!rootsPromise) {
    rootsPromise = Promise.all(ROOT_URLS.map(async url => {
      const response = await fetch(url);
      if (!response.ok) return null;
      const cert = new X509Certificate(Buffer.from(await response.arrayBuffer()));
      return ROOT_FINGERPRINTS.has(fingerprint(cert)) ? cert : null;
    })).then(rows => rows.filter(Boolean));
  }
  return rootsPromise;
}

async function verifyJws(jws) {
  const parts = String(jws || "").split(".");
  if (parts.length !== 3) throw new Error("Apple did not return a signed StoreKit transaction.");
  const [head, body, sig] = parts;
  const header = jsonPart(head);
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new Error("Apple transaction certificate chain is invalid.");
  }

  const certs = header.x5c.map(value => new X509Certificate(Buffer.from(value, "base64")));
  if (certs.some(cert => !validNow(cert))) throw new Error("Apple transaction certificate is not currently valid.");

  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].verify(certs[i + 1].publicKey)) throw new Error("Apple certificate chain verification failed.");
  }

  const last = certs[certs.length - 1];
  let anchored = ROOT_FINGERPRINTS.has(fingerprint(last));
  if (!anchored) {
    const trusted = await roots();
    anchored = trusted.some(root => last.issuer === root.subject && last.verify(root.publicKey));
  }
  if (!anchored) throw new Error("Apple transaction is not anchored to a trusted Apple root.");

  const verified = verifySignature(
    "sha256",
    Buffer.from(head + "." + body),
    { key: certs[0].publicKey, dsaEncoding: "ieee-p1363" },
    b64url(sig)
  );
  if (!verified) throw new Error("Apple transaction signature is invalid.");
  return jsonPart(body);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const body = readBody(req);
    const installId = String(body.installId || "");
    const transaction = body.transaction || {};
    if (!validInstallId(installId)) return res.status(400).json({ error: "Invalid install identifier." });

    const signed = await verifyJws(transaction.jwsRepresentation);
    const productId = String(signed.productId || "");
    const expiresMs = Number(signed.expiresDate || 0);

    if (signed.bundleId !== BUNDLE_ID) throw new Error("Apple bundle ID does not match Droxion Fit.");
    if (!PRODUCTS.has(productId)) throw new Error("Unknown Droxion Fit subscription product.");
    if (signed.revocationDate || signed.revocationReason) throw new Error("This Apple subscription was revoked.");
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) throw new Error("This Apple subscription is not active.");
    if (signed.appAccountToken && String(signed.appAccountToken).toLowerCase() !== installId.toLowerCase()) {
      throw new Error("This Apple subscription belongs to a different install.");
    }

    const expiresAt = new Date(expiresMs).toISOString();
    return res.status(200).json({
      ok: true,
      active: true,
      platform: "ios",
      productId,
      expiresAt,
      entitlementToken: issueEntitlementToken({ installId, productId, platform: "ios", expiresAt })
    });
  } catch (error) {
    console.error("Droxion Fit Apple subscription verification failed", error);
    return res.status(400).json({ error: error?.message || "Apple subscription verification failed." });
  }
}
