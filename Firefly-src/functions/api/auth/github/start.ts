import type { PublishEnv } from "../../../_lib/env";
import { setStateCookie } from "../../../_lib/auth";

type FunctionContext = { request: Request; env: PublishEnv };

export const onRequestGet = (context: FunctionContext): Response => {
	const { request, env } = context;
	if (!env.GITHUB_CLIENT_ID) return new Response("GitHub OAuth is not configured", { status: 503 });
	const state = crypto.randomUUID();
	const callback = new URL("/api/auth/github/callback", request.url).toString();
	const authorize = new URL("https://github.com/login/oauth/authorize");
	authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
	authorize.searchParams.set("redirect_uri", callback);
	const isGitHubApp =
		env.GITHUB_AUTH_TYPE === "github-app" || env.GITHUB_CLIENT_ID.startsWith("Iv23");
	if (!isGitHubApp) {
		authorize.searchParams.set("scope", env.GITHUB_OAUTH_SCOPE?.trim() || "public_repo");
	}
	authorize.searchParams.set("state", state);
	const response = new Response(null, { status: 302, headers: { Location: authorize.toString() } });
	response.headers.append("Set-Cookie", setStateCookie(request, state));
	return response;
};
