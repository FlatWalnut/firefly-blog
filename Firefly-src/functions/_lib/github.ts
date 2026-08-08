import type { PublishBundle, PublishFile } from "./backup";

const API_VERSION = "2022-11-28";

type GitHubRef = { object?: { sha?: string } };
type GitHubCommit = { tree?: { sha?: string } };
type GitHubContent = { content?: string; encoding?: string };
type GitHubError = { message?: string };

const INTEGRATION_ACCESS_ERROR = "resource not accessible by integration";

function redactToken(value: string): string {
	return value.replace(/(Bearer\s+|access_token[=:]\s*)[^\s,;]+/gi, "$1[redacted]");
}

function getUserFacingMessage(status: number, githubMessage: string): string {
	if (status === 403 && githubMessage.toLowerCase().includes(INTEGRATION_ACCESS_ERROR)) {
		return "GitHub 拒绝了发布请求，因为当前集成没有目标仓库的写入权限。GitHub App：授予 Repository contents: Read and write，并将 App 安装到 FlatWalnut/firefly-blog；OAuth App：撤销旧授权后重新连接，公开仓库使用 public_repo，私有仓库使用 repo。完成后请重试。";
	}
	if (status === 401) return "GitHub 授权已失效，请重新连接 GitHub 后重试。";
	if (status === 403) return "GitHub 拒绝了发布请求，请检查当前账号对目标仓库的写入权限后重试。";
	return `GitHub 发布请求失败（HTTP ${status}），请稍后重试。`;
}

export class GitHubApiError extends Error {
	readonly status: number;
	readonly endpoint: string;
	readonly oauthScopes: string | null;
	readonly acceptedOauthScopes: string | null;
	readonly acceptedGithubPermissions: string | null;
	readonly githubMessage: string;
	readonly userMessage: string;

	constructor(options: {
		status: number;
		endpoint: string;
		oauthScopes: string | null;
		acceptedOauthScopes: string | null;
		acceptedGithubPermissions: string | null;
		githubMessage: string;
	}) {
		const githubMessage = redactToken(options.githubMessage);
		super(getUserFacingMessage(options.status, githubMessage));
		this.name = "GitHubApiError";
		this.status = options.status;
		this.endpoint = options.endpoint;
		this.oauthScopes = options.oauthScopes;
		this.acceptedOauthScopes = options.acceptedOauthScopes;
		this.acceptedGithubPermissions = options.acceptedGithubPermissions;
		this.githubMessage = githubMessage;
		this.userMessage = this.message;
	}
}

function apiUrl(owner: string, repo: string, path: string): string {
	return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`;
}

async function githubFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": API_VERSION,
			"User-Agent": "Firefly-blog-publisher",
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});
	if (!response.ok) {
		let message = `GitHub API returned ${response.status}`;
		const oauthScopes = response.headers.get("X-OAuth-Scopes");
		const acceptedOauthScopes = response.headers.get("X-Accepted-OAuth-Scopes");
		const acceptedGithubPermissions = response.headers.get("X-Accepted-GitHub-Permissions");
		try {
			const error = (await response.json()) as GitHubError;
			if (error.message) message = error.message;
		} catch {
			// Keep the generic status when GitHub does not return JSON.
		}
		throw new GitHubApiError({
			status: response.status,
			endpoint: url,
			oauthScopes,
			acceptedOauthScopes,
			acceptedGithubPermissions,
			githubMessage: message,
		});
	}
	return (await response.json()) as T;
}

function utf8ToBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function createBlob(token: string, owner: string, repo: string, file: PublishFile): Promise<string> {
	const content = file.encoding === "base64" ? file.content : utf8ToBase64(file.content);
	const result = await githubFetch<{ sha?: string }>(token, apiUrl(owner, repo, "/git/blobs"), {
		method: "POST",
		body: JSON.stringify({ content, encoding: "base64" }),
	});
	if (!result.sha) throw new Error(`GitHub did not return a blob SHA for ${file.path}`);
	return result.sha;
}

function base64ToUtf8(value: string): string {
	const binary = atob(value.replace(/\s/g, ""));
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

async function readPreviousManifest(
	token: string,
	owner: string,
	repo: string,
	branch: string,
	manifestPath: string,
): Promise<string[]> {
	try {
		const result = await githubFetch<GitHubContent>(token, apiUrl(owner, repo, `/contents/${manifestPath}?ref=${encodeURIComponent(branch)}`));
		if (!result.content) return [];
		const parsed = JSON.parse(base64ToUtf8(result.content)) as { paths?: unknown };
		return Array.isArray(parsed.paths) ? parsed.paths.filter((path): path is string => typeof path === "string") : [];
	} catch (error) {
		if (error instanceof GitHubApiError && error.status === 404) return [];
		throw error;
	}
}

export async function publishBundle(options: {
	token: string;
	owner: string;
	repo: string;
	branch: string;
	bundle: PublishBundle;
	message: string;
}): Promise<{ commitSha: string; commitUrl: string; files: number }> {
	const { token, owner, repo, branch, bundle } = options;
	const ref = await githubFetch<GitHubRef>(token, apiUrl(owner, repo, `/git/ref/heads/${encodeURIComponent(branch)}`));
	const parentSha = ref.object?.sha;
	if (!parentSha) throw new Error("GitHub did not return the branch SHA");
	const parentCommit = await githubFetch<GitHubCommit>(token, apiUrl(owner, repo, `/git/commits/${parentSha}`));
	const baseTreeSha = parentCommit.tree?.sha;
	if (!baseTreeSha) throw new Error("GitHub did not return the base tree SHA");

	const previousPaths = await readPreviousManifest(token, owner, repo, branch, bundle.manifestPath);
	const currentPaths = new Set(bundle.manifest);
	const tree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
	for (const path of previousPaths) {
		if (!currentPaths.has(path)) tree.push({ path, mode: "100644", type: "blob", sha: null });
	}
	for (const file of bundle.files) {
		tree.push({ path: file.path, mode: "100644", type: "blob", sha: await createBlob(token, owner, repo, file) });
	}

	const newTree = await githubFetch<{ sha?: string }>(token, apiUrl(owner, repo, "/git/trees"), {
		method: "POST",
		body: JSON.stringify({ base_tree: baseTreeSha, tree }),
	});
	if (!newTree.sha) throw new Error("GitHub did not return the new tree SHA");
	const commit = await githubFetch<{ sha?: string; html_url?: string }>(token, apiUrl(owner, repo, "/git/commits"), {
		method: "POST",
		body: JSON.stringify({ message: options.message, tree: newTree.sha, parents: [parentSha] }),
	});
	if (!commit.sha) throw new Error("GitHub did not return the commit SHA");
	await githubFetch(token, apiUrl(owner, repo, `/git/refs/heads/${encodeURIComponent(branch)}`), {
		method: "PATCH",
		body: JSON.stringify({ sha: commit.sha, force: false }),
	});
	return {
		commitSha: commit.sha,
		commitUrl: commit.html_url || `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
		files: bundle.files.length,
	};
}
