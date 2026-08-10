// Minimal, dependency-free Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID)
// implemented on WebCrypto so it runs natively on the edge runtime.

const enc = new TextEncoder();

export const b64urlToBytes = (s: string): Uint8Array => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const bytesToB64url = (b: Uint8Array): string => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const concat = (...arrs: Uint8Array[]) => {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

const hmac = async (key: Uint8Array, data: Uint8Array) => {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
};

async function vapidJwt(audience: string, subject: string, publicKey: string, privateKey: string) {
  const pub = b64urlToBytes(publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const signingInput = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)),
  );
  return `${signingInput}.${bytesToB64url(sig)}`;
}

async function encryptPayload(payload: string, p256dh: string, authSecret: string) {
  const uaPublic = b64urlToBytes(p256dh);
  const authKey = b64urlToBytes(authSecret);

  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKeys.privateKey, 256),
  );

  const prkKey = await hmac(authKey, shared);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, serverPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const record = concat(enc.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** 404/410 mean the subscription is dead and should be deactivated. */
  expired: boolean;
  error?: string;
}

export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
  vapid: { publicKey: string; privateKey: string; subject: string },
  ttl = 3600,
): Promise<SendResult> {
  try {
    const audience = new URL(target.endpoint).origin;
    const jwt = await vapidJwt(audience, vapid.subject, vapid.publicKey, vapid.privateKey);
    const body = await encryptPayload(JSON.stringify(payload), target.p256dh, target.auth);

    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttl),
        Urgency: "normal",
      },
      body,
    });

    if (res.ok) return { ok: true, status: res.status, expired: false };
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, expired: res.status === 404 || res.status === 410, error: text.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, expired: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}