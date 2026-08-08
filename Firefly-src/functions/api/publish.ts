import { buildPublishBundle } from "../_lib/backup";
import { getSession, jsonResponse } from "../_lib/auth";
import { getBranch, getRepository, type PublishEnv } from "../_lib/env";
import { GitHubApiError, publishBundle } from "../_lib/github";

type FunctionContext = { request: Request; env: PublishEnv };

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

export const onRequestPost = async (context: FunctionContext): Promise<Response> => {
	const { request, env } = context;
	const session = await getSession(request, env);
	if (!session) return jsonResponse({ error: "GitHub account is not connected" }, 401);

	let repository: { owner: string; repo: string };
	let branch: string;
	try {
		repository = getRepository(env);
		branch = getBranch(env);
	} catch (error) {
		return jsonResponse({ error: error instanceof Error ? error.message : "Publishing is not configured" }, 503);
	}
	const allowedLogin = env.GITHUB_ALLOWED_LOGIN?.trim();
	if (allowedLogin && session.login.toLowerCase() !== allowedLogin.toLowerCase()) {
		return jsonResponse({ error: "This GitHub account is not allowed to publish" }, 403);
	}
	if (!allowedLogin && session.login.toLowerCase() !== repository.owner.toLowerCase()) {
		return jsonResponse({ error: "Only the repository owner can publish" }, 403);
	}

	try {
		const bodyBytes = await request.arrayBuffer();
		if (bodyBytes.byteLength > MAX_REQUEST_BYTES) return jsonResponse({ error: "Backup is too large" }, 413);
		const body = JSON.parse(new TextDecoder().decode(bodyBytes)) as { backup?: unknown; message?: unknown };
		const bundle = buildPublishBundle(body.backup);
		const message = typeof body.message === "string" && body.message.trim()
			? body.message.trim().slice(0, 120)
			: `chore(content): publish blog content ${new Date().toISOString().slice(0, 10)}`;
		const result = await publishBundle({
			token: session.token,
			owner: repository.owner,
			repo: repository.repo,
			branch,
			bundle,
			message,
		});
		return jsonResponse({ ok: true, ...result, branch, repository: `${repository.owner}/${repository.repo}` });
	} catch (error) {
		if (error instanceof GitHubApiError) {
			console.error("Blog publish failed", {
				status: error.status,
				endpoint: error.endpoint,
				oauthScopes: error.oauthScopes,
				acceptedOauthScopes: error.acceptedOauthScopes,
				message: error.githubMessage,
			});
			return jsonResponse({ error: error.userMessage }, 502);
		}
		console.error("Blog publish failed", error instanceof Error ? error.message : "unknown error");
		return jsonResponse({ error: error instanceof Error ? error.message : "Blog publish failed" }, 400);
	}
};
