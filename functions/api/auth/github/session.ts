import { getSession, jsonResponse } from "../../../_lib/auth";
import { getRepository, type PublishEnv } from "../../../_lib/env";

type FunctionContext = { request: Request; env: PublishEnv };
type GitHubRepository = { permissions?: { push?: boolean } };
type RepositoryAccessError = "forbidden" | "not-found" | "unavailable";

export const onRequestGet = async (
	context: FunctionContext,
): Promise<Response> => {
	const session = await getSession(context.request, context.env);
	let configured = Boolean(
		context.env.GITHUB_CLIENT_ID &&
			context.env.GITHUB_CLIENT_SECRET &&
			context.env.SESSION_SECRET &&
			context.env.SESSION_SECRET.length >= 32,
	);
	try {
		getRepository(context.env);
	} catch {
		configured = false;
	}
	if (!session) return jsonResponse({ connected: false, configured });

	let repositoryWriteAccess = false;
	let repositoryAccessError: RepositoryAccessError | undefined;
	try {
		const repository = getRepository(context.env);
		const repositoryResponse = await fetch(
			`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${session.token}`,
					"X-GitHub-Api-Version": "2022-11-28",
					"User-Agent": "Firefly-blog-publisher",
				},
			},
		);
		if (repositoryResponse.ok) {
			const repositoryInfo = (await repositoryResponse.json()) as GitHubRepository;
			repositoryWriteAccess = repositoryInfo.permissions?.push === true;
		} else {
			repositoryAccessError =
				repositoryResponse.status === 403
					? "forbidden"
					: repositoryResponse.status === 404
						? "not-found"
						: "unavailable";
		}
	} catch {
		repositoryAccessError = "unavailable";
	}

	return jsonResponse({
		connected: true,
		configured,
		login: session.login,
		repositoryWriteAccess,
		repositoryAccessError,
	});
};
