/**
 * SmartLogix — ECDSA Bid Signing Utility (Task 6.4)
 *
 * Uses the Web Crypto API (ECDSA P-256, SHA-256) to:
 * 1. Generate a key pair (driver's signing key)
 * 2. Sign a bid payload
 * 3. Export the public key in SPKI/base64 format
 *
 * This is byte-compatible with the Python server's
 * cryptography.hazmat.primitives.asymmetric.ec verification.
 */

/**
 * Generate a new ECDSA P-256 key pair for bid signing.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // extractable
    ["sign", "verify"],
  );
}

/**
 * Export a public key to base64-encoded SPKI format.
 * This is the format stored in the carrier_keys table and
 * verified by the Python backend.
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exported);
}

/**
 * Sign a bid payload with the driver's private key.
 *
 * @param privateKey - The ECDSA private key
 * @param payload - The exact string that will be verified server-side
 * @returns Base64-encoded signature (IEEE P1363 format, 64 bytes for P-256)
 */
export async function signBid(
  privateKey: CryptoKey,
  payload: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    privateKey,
    data,
  );

  return arrayBufferToBase64(signature);
}

/**
 * Build the canonical signed payload for a bid.
 * Both client and server must agree on this format.
 */
export function buildBidPayload(
  routeId: string,
  carrierId: string,
  bidAmountPaise: number,
  timestamp: string,
): string {
  return JSON.stringify({
    route_id: routeId,
    carrier_id: carrierId,
    bid_amount_paise: bidAmountPaise,
    timestamp: timestamp,
  });
}

/**
 * Verify a signature locally (for testing/demo purposes).
 */
export async function verifySignature(
  publicKey: CryptoKey,
  signature: string,
  payload: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const sigBytes = base64ToArrayBuffer(signature);

  return crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    publicKey,
    sigBytes,
    data,
  );
}

// ---- Helpers ----

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
