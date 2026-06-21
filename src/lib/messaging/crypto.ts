"use client";

import { useEffect, useState } from "react";
import _sodium from "libsodium-wrappers-sumo";
import { getDb, type Peer, type Message } from "@/lib/db/db";

// Backend URL for messaging relay — separate from AI backend
// Can be set via env var, otherwise uses same host as frontend (assumes backend on different port or same domain)
const MSG_BACKEND_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MSG_BACKEND_URL) ||
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  "";

// localStorage keys (kept separate from IndexedDB for sync access)
const LS_IDENTITY_KEY = "raooza.identity.v1";

export interface Identity {
  id: string; // short hash of pubkey (16 chars)
  publicKey: string; // base64
  privateKey: string; // base64 (NEVER leaves this device)
}

let _sodiumReady: Promise<any> | null = null;
async function getSodium() {
  if (!_sodiumReady) {
    _sodiumReady = _sodium.ready.then(() => _sodium);
  }
  return _sodiumReady;
}

// Generate or load identity from localStorage
export async function getOrCreateIdentity(): Promise<Identity> {
  const sodium = await getSodium();
  const existing = localStorage.getItem(LS_IDENTITY_KEY);
  if (existing) {
    try {
      return JSON.parse(existing) as Identity;
    } catch {}
  }
  // Generate new keypair (X25519 for ECDH)
  const keypair = sodium.crypto_box_keypair();
  const publicKey = sodium.to_base64(keypair.publicKey, _sodium.base64_variants.URLSAFE_NO_PADDING);
  const privateKey = sodium.to_base64(keypair.privateKey, _sodium.base64_variants.URLSAFE_NO_PADDING);
  // Short ID: first 16 chars of SHA256 hash of pubkey
  const hash = sodium.crypto_generichash(8, keypair.publicKey);
  const id = "raooza-" + sodium.to_base64(hash, _sodium.base64_variants.URLSAFE_NO_PADDING).slice(0, 10);
  const identity: Identity = { id, publicKey, privateKey };
  localStorage.setItem(LS_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

// Encrypt plaintext for a recipient (by their base64 pubkey)
export async function encryptForRecipient(
  recipientPublicKeyB64: string,
  plaintext: string,
): Promise<{ ciphertext: string; nonce: string }> {
  const sodium = await getSodium();
  const identity = await getOrCreateIdentity();
  const recipientPk = sodium.from_base64(recipientPublicKeyB64, _sodium.base64_variants.URLSAFE_NO_PADDING);
  const senderSk = sodium.from_base64(identity.privateKey, _sodium.base64_variants.URLSAFE_NO_PADDING);
  const message = sodium.from_string(plaintext);
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_box(message, nonce, recipientPk, senderSk);
  return {
    ciphertext: sodium.to_base64(ciphertext, _sodium.base64_variants.URLSAFE_NO_PADDING),
    nonce: sodium.to_base64(nonce, _sodium.base64_variants.URLSAFE_NO_PADDING),
  };
}

// Decrypt ciphertext using our private key + sender's pubkey
export async function decryptFromSender(
  senderPublicKeyB64: string,
  ciphertextB64: string,
  nonceB64: string,
): Promise<string> {
  const sodium = await getSodium();
  const identity = await getOrCreateIdentity();
  const senderPk = sodium.from_base64(senderPublicKeyB64, _sodium.base64_variants.URLSAFE_NO_PADDING);
  const ourSk = sodium.from_base64(identity.privateKey, _sodium.base64_variants.URLSAFE_NO_PADDING);
  const ciphertext = sodium.from_base64(ciphertextB64, _sodium.base64_variants.URLSAFE_NO_PADDING);
  const nonce = sodium.from_base64(nonceB64, _sodium.base64_variants.URLSAFE_NO_PADDING);
  try {
    const decrypted = sodium.crypto_box_open(ciphertext, nonce, senderPk, ourSk);
    return sodium.to_string(decrypted);
  } catch (e) {
    throw new Error("Falha ao descriptografar");
  }
}

// Hook used by components
export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrCreateIdentity()
      .then(setIdentity)
      .finally(() => setLoading(false));
  }, []);

  return { identity, loading };
}

// === Backend communication ===

function endpoint(path: string): string {
  if (MSG_BACKEND_URL) return `${MSG_BACKEND_URL}${path}`;
  return path;
}

// Publish our pubkey so others can find us by ID
export async function publishPublicKey(identity: Identity): Promise<void> {
  if (!MSG_BACKEND_URL) return; // No backend configured — silently skip
  try {
    await fetch(endpoint("/pubkeys/" + encodeURIComponent(identity.id)), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: identity.publicKey }),
    });
  } catch {}
}

// Fetch someone's pubkey by their ID
export async function fetchPublicKey(peerId: string): Promise<string | null> {
  if (!MSG_BACKEND_URL) return null;
  try {
    const res = await fetch(endpoint("/pubkeys/" + encodeURIComponent(peerId)));
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

// Send encrypted message via backend
export async function sendEncryptedMessage(
  recipientId: string,
  recipientPublicKey: string,
  plaintext: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!MSG_BACKEND_URL) {
    return { ok: false, error: "Backend de mensagens não configurado" };
  }
  try {
    const { ciphertext, nonce } = await encryptForRecipient(recipientPublicKey, plaintext);
    const identity = await getOrCreateIdentity();
    const res = await fetch(endpoint("/messages/" + encodeURIComponent(recipientId)), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromId: identity.id,
        fromPublicKey: identity.publicKey,
        ciphertext,
        nonce,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// Poll backend for incoming messages
export async function pollMessages(identity: Identity): Promise<Array<{
  messageId: string;
  fromId: string;
  fromPublicKey: string;
  ciphertext: string;
  nonce: string;
  timestamp: string;
}>> {
  if (!MSG_BACKEND_URL) return [];
  try {
    const res = await fetch(endpoint("/messages/" + encodeURIComponent(identity.id)));
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? [];
  } catch {
    return [];
  }
}

// Acknowledge message receipt (so backend can delete it)
export async function acknowledgeMessage(messageId: string): Promise<void> {
  if (!MSG_BACKEND_URL) return;
  try {
    await fetch(endpoint("/messages/" + encodeURIComponent(messageId)), { method: "DELETE" });
  } catch {}
}

// === Local storage helpers ===

export async function addPeer(displayName: string, peerId: string, publicKey: string): Promise<Peer> {
  const peer: Peer = {
    id: peerId,
    displayName,
    publicKey,
    addedAt: new Date().toISOString(),
  };
  await getDb().peers.put(peer);
  return peer;
}

export async function saveMessage(
  peerId: string,
  direction: "in" | "out",
  plaintext: string,
  pinned = false,
): Promise<Message> {
  const msg: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    peerId,
    direction,
    plaintext,
    createdAt: new Date().toISOString(),
    read: direction === "out", // outgoing is already "read"
    pinned,
    pinnedAt: pinned ? new Date().toISOString() : undefined,
  };
  await getDb().messages.add(msg);
  await getDb().peers.update(peerId, { lastMessageAt: msg.createdAt });
  return msg;
}
