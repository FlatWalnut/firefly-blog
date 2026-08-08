export type BackupPost = {
	id?: string;
	title: string;
	slug: string;
	status: "published" | "draft";
	published: string;
	updated?: string;
	description?: string;
	tags?: string[];
	category?: string;
	cover?: string;
	content?: string;
};

export type BackupSettings = {
	siteTitle?: string;
	subtitle?: string;
	description?: string;
	author?: string;
	announcement?: string;
	desktopBg?: string;
	mobileBg?: string;
	accent?: string;
};

export type BackupMedia = {
	id?: string;
	name: string;
	url: string;
	kind?: "image";
};

export type BackupPayload = {
	posts: BackupPost[];
	settings: BackupSettings;
	media: BackupMedia[];
};

export type PublishFile = {
	path: string;
	content: string;
	encoding: "utf-8" | "base64";
};

export type PublishBundle = {
	files: PublishFile[];
	manifestPath: string;
	manifest: string[];
};

const MAX_POSTS = 500;
const MAX_MEDIA = 500;
const MAX_TEXT_LENGTH = 1_000_000;

function text(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function safeSlug(value: string, fallback: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
	return slug || fallback;
}

function safeFileName(value: string, fallback: string): string {
	const cleaned = value
		.normalize("NFKC")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
	return cleaned || fallback;
}

function yamlString(value: string): string {
	return JSON.stringify(value.replace(/\r\n/g, "\n"));
}

function yamlList(values: string[]): string {
	return `[${values.map((value) => yamlString(value)).join(", ")}]`;
}

function normalizeDate(value: string | undefined, fallback: string): string {
	const date = new Date(value || fallback);
	return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function parseDataUrl(value: string): { mime: string; base64: string } | null {
	const match = value.match(/^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
	if (!match) return null;
	return { mime: match[1], base64: match[2].replace(/\s/g, "") };
}

function extensionForMime(mime: string): string {
	const extensions: Record<string, string> = {
		"image/avif": "avif",
		"image/gif": "gif",
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/svg+xml": "svg",
		"image/webp": "webp",
	};
	return extensions[mime] || "bin";
}

function uniqueFilePath(files: PublishFile[], path: string): string {
	const existing = new Set(files.map((file) => file.path));
	if (!existing.has(path)) return path;
	const extensionIndex = path.lastIndexOf(".");
	const base = extensionIndex > path.lastIndexOf("/") ? path.slice(0, extensionIndex) : path;
	const extension = extensionIndex > path.lastIndexOf("/") ? path.slice(extensionIndex) : "";
	let suffix = 2;
	while (existing.has(`${base}-${suffix}${extension}`)) suffix += 1;
	return `${base}-${suffix}${extension}`;
}

function addDataUrl(
	files: PublishFile[],
	path: string,
	value: string,
): string {
	const data = parseDataUrl(value);
	if (!data) return value;
	const uniquePath = uniqueFilePath(files, path);
	files.push({ path: uniquePath, content: data.base64, encoding: "base64" });
	return `/${uniquePath.replace(/^public\//, "")}`;
}

function normalizeBackup(input: unknown): BackupPayload {
	if (!input || typeof input !== "object") throw new Error("backup must be an object");
	const value = input as Record<string, unknown>;
	if (!Array.isArray(value.posts) || !Array.isArray(value.media)) {
		throw new Error("backup.posts and backup.media must be arrays");
	}
	if (value.posts.length > MAX_POSTS || value.media.length > MAX_MEDIA) {
		throw new Error("backup contains too many items");
	}
	const settings = value.settings && typeof value.settings === "object" ? value.settings : {};
	return {
		posts: value.posts as BackupPost[],
		settings: settings as BackupSettings,
		media: value.media as BackupMedia[],
	};
}

export function buildPublishBundle(input: unknown): PublishBundle {
	const backup = normalizeBackup(input);
	const files: PublishFile[] = [];
	const ownedPaths = new Set<string>();
	const usedSlugs = new Set<string>();

	for (const [index, rawPost] of backup.posts.entries()) {
		if (!rawPost || typeof rawPost !== "object") throw new Error(`posts[${index}] is invalid`);
		const post = rawPost as BackupPost;
		const title = text(post.title).trim();
		if (!title) throw new Error(`posts[${index}] is missing title`);
		let slug = safeSlug(text(post.slug), `post-${index + 1}`);
		let suffix = 2;
		while (usedSlugs.has(slug)) slug = `${safeSlug(text(post.slug), `post-${index + 1}`)}-${suffix++}`;
		usedSlugs.add(slug);

		const filePath = `src/content/posts/${slug}.md`;
		const content = text(post.content);
		if (content.length > MAX_TEXT_LENGTH) throw new Error(`post ${slug} is too large`);
		const image = text(post.cover);
		const imagePath = image.startsWith("data:")
			? addDataUrl(files, `public/uploads/${slug}-cover.${extensionForMime(parseDataUrl(image)?.mime || "image/webp")}`, image)
			: image;
		if (imagePath.startsWith("/uploads/")) ownedPaths.add(`public${imagePath}`);
		const published = normalizeDate(post.published, new Date().toISOString());
		const updated = normalizeDate(post.updated, published);
		const tags = Array.isArray(post.tags) ? post.tags.map((tag) => text(tag).trim()).filter(Boolean) : [];
		const frontmatter = [
			"---",
			`title: ${yamlString(title)}`,
			`published: ${published}`,
			`updated: ${updated}`,
			`draft: ${post.status !== "published"}`,
			`description: ${yamlString(text(post.description))}`,
			`tags: ${yamlList(tags)}`,
			`category: ${yamlString(text(post.category))}`,
			`image: ${yamlString(imagePath)}`,
			`author: ${yamlString(text(backup.settings.author))}`,
			"---",
			"",
		].join("\n");
		files.push({ path: filePath, content: `${frontmatter}${content.replace(/^\n+/, "")}`, encoding: "utf-8" });
		ownedPaths.add(filePath);
	}

	for (const [index, rawMedia] of backup.media.entries()) {
		if (!rawMedia || typeof rawMedia !== "object") continue;
		const media = rawMedia as BackupMedia;
		const data = parseDataUrl(text(media.url));
		if (!data) continue;
		const base = safeFileName(text(media.name), `media-${index + 1}`);
		const filePath = uniqueFilePath(files, `public/uploads/${base}.${extensionForMime(data.mime)}`);
		files.push({ path: filePath, content: data.base64, encoding: "base64" });
		ownedPaths.add(filePath);
	}

	const settings = {
		siteTitle: text(backup.settings.siteTitle),
		subtitle: text(backup.settings.subtitle),
		description: text(backup.settings.description),
		author: text(backup.settings.author),
		announcement: text(backup.settings.announcement),
		desktopBg: text(backup.settings.desktopBg),
		mobileBg: text(backup.settings.mobileBg),
		accent: text(backup.settings.accent),
	};
	for (const key of ["desktopBg", "mobileBg"] as const) {
		const value = settings[key];
		if (value.startsWith("data:")) {
			const data = parseDataUrl(value);
			settings[key] = addDataUrl(
				files,
				`public/uploads/admin-${key}.${extensionForMime(data?.mime || "image/webp")}`,
				value,
			);
			if (settings[key].startsWith("/uploads/")) ownedPaths.add(`public${settings[key]}`);
		}
	}
	const settingsPath = "public/admin-settings.json";
	files.push({ path: settingsPath, content: JSON.stringify(settings, null, 2), encoding: "utf-8" });
	ownedPaths.add(settingsPath);

	const manifestPath = ".firefly-publish-manifest.json";
	const manifest = [...ownedPaths].sort();
	files.push({
		path: manifestPath,
		content: JSON.stringify({ version: 1, paths: manifest }, null, 2),
		encoding: "utf-8",
	});

	return { files, manifestPath, manifest: [...manifest, manifestPath] };
}
