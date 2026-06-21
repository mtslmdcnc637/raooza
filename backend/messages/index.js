// Raooza Messages Backend — Ephemeral E2E-encrypted relay
//
// Design:
// - Stores ONLY ciphertexts (encrypted on client with libsodium crypto_box)
// - 24h TTL — auto-purged after that
// - Whitelist: only accepts messages to a recipientId that has published a pubkey
// - No accounts, no auth — identity = your public key hash
// - Poll-based (no WebSocket needed for v1)

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.MSG_PORT || 8789;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // every 10 min
const MAX_QUEUE_PER_USER = 100; // anti-spam

// In-memory state
const pubkeys = new Map(); // peerId -> { publicKey, ts }
const messageQueues = new Map(); // recipientId -> Array<{ id, fromId, fromPublicKey, ciphertext, nonce, ts }>

function log(level, ...args) {
  const levels = ["debug", "info", "warn", "error"];
  if (levels.indexOf(level) >= levels.indexOf(process.env.LOG_LEVEL || "info")) {
    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
    if (level === "error") console.error(prefix, ...args);
    else if (level === "warn") console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }
}

// Cleanup expired entries
setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [recipientId, queue] of messageQueues) {
    const before = queue.length;
    const filtered = queue.filter((m) => now - m.ts < TTL_MS);
    messageQueues.set(recipientId, filtered);
    purged += before - filtered.length;
  }
  // Purge old pubkeys (30 days)
  for (const [peerId, entry] of pubkeys) {
    if (now - entry.ts > 30 * 24 * 60 * 60 * 1000) {
      pubkeys.delete(peerId);
    }
  }
  if (purged > 0) log("debug", `Cleanup: purged ${purged} expired messages`);
}, CLEANUP_INTERVAL_MS);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed`));
      }
    },
  }),
);

app.use((req, _res, next) => {
  log("info", `${req.method} ${req.path}`);
  next();
});

// === Health ===
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "raooza-messages",
    ttl: TTL_MS / 1000 / 60 / 60 + "h",
    pubkeys: pubkeys.size,
    pendingMessages: Array.from(messageQueues.values()).reduce((a, q) => a + q.length, 0),
  });
});

// === Pubkey registry ===

// Publish your pubkey (so others can encrypt to you)
// Idempotent: re-publishing refreshes timestamp
app.post("/pubkeys/:peerId", (req, res) => {
  const { peerId } = req.params;
  const { publicKey } = req.body;
  if (!publicKey || typeof publicKey !== "string") {
    return res.status(400).json({ error: "publicKey required" });
  }
  if (peerId.length > 100) {
    return res.status(400).json({ error: "peerId too long" });
  }
  pubkeys.set(peerId, { publicKey, ts: Date.now() });
  log("debug", `Pubkey published for ${peerId.slice(0, 16)}...`);
  res.json({ ok: true });
});

// Get someone's pubkey (so you can encrypt to them)
app.get("/pubkeys/:peerId", (req, res) => {
  const { peerId } = req.params;
  const entry = pubkeys.get(peerId);
  if (!entry) {
    return res.status(404).json({ error: "peer not found — they need to publish their pubkey first" });
  }
  res.json({ publicKey: entry.publicKey });
});

// === Messages ===

// Send encrypted message to recipientId
app.post("/messages/:recipientId", (req, res) => {
  const { recipientId } = req.params;
  const { fromId, fromPublicKey, ciphertext, nonce } = req.body;

  // Validate
  if (!fromId || !fromPublicKey || !ciphertext || !nonce) {
    return res.status(400).json({ error: "fromId, fromPublicKey, ciphertext, nonce required" });
  }
  // Whitelist: recipient must have published their pubkey
  if (!pubkeys.has(recipientId)) {
    return res.status(404).json({ error: "recipient not found — they need to publish their pubkey first" });
  }
  // Anti-spam: cap queue per recipient
  const queue = messageQueues.get(recipientId) || [];
  if (queue.length >= MAX_QUEUE_PER_USER) {
    return res.status(429).json({ error: "recipient queue full (too many pending messages)" });
  }

  const message = {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromId,
    fromPublicKey,
    ciphertext,
    nonce,
    ts: Date.now(),
  };
  queue.push(message);
  messageQueues.set(recipientId, queue);
  log("debug", `Message queued for ${recipientId.slice(0, 16)}... from ${fromId.slice(0, 16)}...`);
  res.json({ ok: true, messageId: message.id });
});

// Poll for incoming messages (returns and DOES NOT delete — DELETE on ack)
app.get("/messages/:recipientId", (req, res) => {
  const { recipientId } = req.params;
  const queue = messageQueues.get(recipientId) || [];
  // Filter out expired
  const now = Date.now();
  const fresh = queue.filter((m) => now - m.ts < TTL_MS);
  if (fresh.length !== queue.length) {
    messageQueues.set(recipientId, fresh);
  }
  res.json({
    messages: fresh.map((m) => ({
      messageId: m.id,
      fromId: m.fromId,
      fromPublicKey: m.fromPublicKey,
      ciphertext: m.ciphertext,
      nonce: m.nonce,
      timestamp: new Date(m.ts).toISOString(),
    })),
  });
});

// Acknowledge — delete a specific message after recipient has it
app.delete("/messages/:messageId", (req, res) => {
  const { messageId } = req.params;
  // We don't know which recipientId it belongs to without scanning
  let found = false;
  for (const [recipientId, queue] of messageQueues) {
    const idx = queue.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      queue.splice(idx, 1);
      messageQueues.set(recipientId, queue);
      found = true;
      break;
    }
  }
  if (!found) {
    return res.status(404).json({ error: "message not found (may have already been acked)" });
  }
  res.json({ ok: true });
});

// === 404 ===
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// === Error handler ===
app.use((err, _req, res, _next) => {
  log("error", "Unhandled:", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  log("info", `Raooza messages backend listening on port ${PORT}`);
  log("info", `TTL: ${TTL_MS / 1000 / 60 / 60}h`);
  log("info", `Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  log("info", `Max queue per user: ${MAX_QUEUE_PER_USER}`);
});
