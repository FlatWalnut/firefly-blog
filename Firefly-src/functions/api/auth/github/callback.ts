import { getRepository, type PublishEnv } from "../../../_lib/env";
import {
	constantTimeEqual,
	clearAuthCookies,
	createSessionCookie,
	getStateCookie,
	jsonResponse,
} from "../../../_lib/auth";

type FunctionContext = { request: Request; env: PublishEnv };
type GitHubTokenResponse = { access_token?: string; error?: string };
type GitHubUser = { login?: string };
type GitHubRepository = { permissions?: { push?: boolean } };

function authErrorRedirect(request: Request, reason: string): Response {
	const location = new URL("/admin/", request.url);
	location.searchParams.set("github", "error");
	location.searchParams.set("reason", reason);
	const response = new Response(null, { status: 302, headers: { Location: location.toString() } });
	for (const [key, value] of clearAuthCookies(request)) response.headers.append(key, value);
	return response;
}

export const onRequestGet = async (context: FunctionContext): Promise<Response> => {
	const { request, env } = context;
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const stateCookie = getStateCookie(request);
	if (!code || !state || !stateCookie || !constantTimeEqual(state, stateCookie)) {
		return jsonResponse({ error: "Invalid OAuth state" }, 400);
	}
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		return jsonResponse({ error: "GitHub OAuth is not configured" }, 503);
	}

	try {
		const callback = new URL("/api/auth/github/callback", request.url).toString();
		const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callback }),
		});
		if (!tokenResponse.ok) return jsonResponse({ error: "GitHub OAuth token exchange failed" }, 502);
		const token = (await tokenResponse.json()) as GitHubTokenResponse;
		if (!token.access_token) return jsonResponse({ error: token.error || "GitHub did not return an access token" }, 502);

		const userResponse = await fetch("https://api.github.com/user", {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token.access_token}`,
				"X-GitHub-Api-Version": "2022-11-28",
				"User-Agent": "Firefly-blog-publisher",
			},
		});
		if (!userResponse.ok) return jsonResponse({ error: "Could not read GitHub user" }, 502);
		const user = (await userResponse.json()) as GitHubUser;
		if (!user.login) return jsonResponse({ error: "GitHub user has no login" }, 502);

		let repository: { owner: string; repo: string };
		try {
			repository = getRepository(env);
		} catch {
			return jsonResponse({ error: "Publishing repository is not configured" }, 503);
		}
		const repositoryResponse = await fetch(
			`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${token.access_token}`,
					"X-GitHub-Api-Version": "2022-11-28",
					"User-Agent": "Firefly-blog-publisher",
				},
			},
		);
		if (!repositoryResponse.ok) {
			if (repositoryResponse.status === 403 || repositoryResponse.status === 404) return authErrorRedirect(request, "integration-access");
			return authErrorRedirect(request, "repository-unavailable");
		}
		const repositoryInfo = (await repositoryResponse.json()) as GitHubRepository;
		if (repositoryInfo.permissions?.push !== true) return authErrorRedirect(request, "repository-read-only");

		const sessionCookie = await createSessionCookie(request, env, { login: user.login, token: token.access_token });
		const response = new Response(null, { status: 302, headers: { Location: "/admin/?github=connected" } });
		response.headers.append("Set-Cookie", sessionCookie);
		return response;
	} catch (error) {
		console.error("GitHub OAuth callback failed", error instanceof Error ? error.message : "unknown error");
		return jsonResponse({ error: "GitHub OAuth callback failed" }, 502);
	}
};
