import type { PublishBundle, PublishFile } from "./backup";

const API_VERSION = "2022-11-28";

type GitHubRef = { object?: { sha?: string } };
type GitHubCommit = { tree?: { sha?: string } };
type GitHubContent = { content?: string; encoding?: string };
type GitHubError = { message?: string };

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
		try {
			const error = (await response.json()) as GitHubError;
			if (error.message) message = error.message;
		} catch {
			// Keep the generic status when GitHub does not return JSON.
		}
		throw new Error(message);
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
		if (error instanceof Error && error.message.toLowerCase().includes("not found")) return [];
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
