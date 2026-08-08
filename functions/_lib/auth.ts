import type { PublishEnv } from "./env";

const STATE_COOKIE = "firefly_oauth_state";
const SESSION_COOKIE = "firefly_github_session";
const encoder = new TextEncoder();

export type GitHubSession = {
	login: string;
	token: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(normalized);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sessionKey(secret: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
	return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function cookieValue(request: Request, name: string): string | null {
	const cookies = request.headers.get("Cookie")?.split(";") || [];
	for (const cookie of cookies) {
		const [key, ...parts] = cookie.trim().split("=");
		if (key === name) return parts.join("=") || null;
	}
	return null;
}

function cookie(name: string, value: string, request: Request, maxAge: number): string {
	const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
	return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearAuthCookies(request: Request): Headers {
	const headers = new Headers();
	const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
	headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
	headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
	return headers;
}

export function setStateCookie(request: Request, state: string): string {
	return cookie(STATE_COOKIE, state, request, 600);
}

export function getStateCookie(request: Request): string | null {
	return cookieValue(request, STATE_COOKIE);
}

export function constantTimeEqual(left: string, right: string): boolean {
	const a = encoder.encode(left);
	const b = encoder.encode(right);
	let difference = a.length ^ b.length;
	const length = Math.max(a.length, b.length);
	for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
	return difference === 0;
}

export async function createSessionCookie(
	request: Request,
	env: PublishEnv,
	session: GitHubSession,
): Promise<string> {
	if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
		throw new Error("SESSION_SECRET must be at least 32 characters");
	}
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const payload = encoder.encode(JSON.stringify({ ...session, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
	const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sessionKey(env.SESSION_SECRET), payload));
	const combined = new Uint8Array(iv.length + encrypted.length);
	combined.set(iv, 0);
	combined.set(encrypted, iv.length);
	return cookie(SESSION_COOKIE, base64UrlEncode(combined), request, 7 * 24 * 60 * 60);
}

export async function getSession(request: Request, env: PublishEnv): Promise<GitHubSession | null> {
	if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return null;
	const value = cookieValue(request, SESSION_COOKIE);
	if (!value) return null;
	try {
		const combined = base64UrlDecode(value);
		if (combined.length < 13) return null;
		const iv = combined.slice(0, 12);
		const encrypted = combined.slice(12);
		const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await sessionKey(env.SESSION_SECRET), encrypted);
		const session = JSON.parse(new TextDecoder().decode(decrypted)) as GitHubSession & { expiresAt?: number };
		if (!session.login || !session.token || !session.expiresAt || session.expiresAt < Date.now()) return null;
		return { login: session.login, token: session.token };
	} catch {
		return null;
	}
}

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
	});
}
