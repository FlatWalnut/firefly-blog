export type PublishEnv = {
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GITHUB_REPOSITORY?: string;
	GITHUB_BRANCH?: string;
	GITHUB_OAUTH_SCOPE?: string;
	GITHUB_AUTH_TYPE?: "github-app" | "oauth-app";
	GITHUB_ALLOWED_LOGIN?: string;
	SESSION_SECRET?: string;
};

export function getRepository(env: PublishEnv): { owner: string; repo: string } {
	const repository = env.GITHUB_REPOSITORY?.trim();
	if (!repository || !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
		throw new Error("GITHUB_REPOSITORY is not configured");
	}
	const [owner, repo] = repository.split("/");
	if (!owner || !repo) throw new Error("GITHUB_REPOSITORY is not configured");
	return { owner, repo };
}

export function getBranch(env: PublishEnv): string {
	const branch = env.GITHUB_BRANCH?.trim() || "main";
	if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.startsWith("/") || branch.endsWith("/")) {
		throw new Error("GITHUB_BRANCH is invalid");
	}
	return branch;
}
