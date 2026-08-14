import fs from "node:fs";
import path from "node:path";
import { getCollection } from "astro:content";
import type { GalleryAlbum } from "@/types/config";
import { url } from "@/utils/url-utils";

function withBase(assetPath: string): string {
	if (!assetPath) return "";
	if (/^(https?:)?\/\//i.test(assetPath) || /^(data|blob):/i.test(assetPath)) {
		return assetPath;
	}
	const normalizedPath = assetPath.startsWith("/")
		? assetPath
		: `/${assetPath}`;
	const base = import.meta.env.BASE_URL || "/";
	if (base !== "/" && normalizedPath.startsWith(base)) {
		return normalizedPath;
	}
	return url(normalizedPath);
}

/**
 * 扫描相册目录中的所有图片文件
 */
export function scanAlbumPhotos(albumId: string): string[] {
	const dir = path.join(process.cwd(), "public", "gallery", albumId);
	if (!fs.existsSync(dir)) return [];
	const files = fs
		.readdirSync(dir)
		.filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
		.sort();
	// 将 cover.* 排到第一位
	const coverIdx = files.findIndex((f) => /^cover\./i.test(f));
	if (coverIdx > 0) {
		const [coverFile] = files.splice(coverIdx, 1);
		files.unshift(coverFile);
	}
	const localPhotos = files.map((f) => withBase(`/gallery/${albumId}/${f}`));

	// 读取 urls.txt 中的远程图片 URL
	const urlsFile = path.join(dir, "urls.txt");
	let remotePhotos: string[] = [];
	if (fs.existsSync(urlsFile)) {
		remotePhotos = fs
			.readFileSync(urlsFile, "utf-8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
	}

	return [...localPhotos, ...remotePhotos];
}

/**
 * 获取相册封面图
 * 优先级：手动指定 > cover.* 文件 > 第一张图片
 */
export function getAlbumCover(album: GalleryAlbum, photos: string[]): string {
	if (album.cover) return withBase(album.cover);
	const coverFile = photos.find((p) => /\/cover\./i.test(p));
	return coverFile || photos[0] || "";
}

/**
 * 扫描所有博客文章的图片目录，为每篇有图片的文章生成一个虚拟相册
 */
export async function getPostImageAlbums(): Promise<
	(GalleryAlbum & { photos: string[] })[]
> {
	const posts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const albums: (GalleryAlbum & { photos: string[] })[] = [];

	for (const post of posts) {
		const imagesDir = path.join(
			process.cwd(),
			"public",
			"gallery",
			`post-${post.id}`,
		);
		if (!fs.existsSync(imagesDir)) continue;

		const files = fs
			.readdirSync(imagesDir)
			.filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))
			.sort();

		const coverIdx = files.findIndex((f) => /^cover\./i.test(f));
		if (coverIdx > 0) {
			const [coverFile] = files.splice(coverIdx, 1);
			files.unshift(coverFile);
		}

		const photos = files.map((f) =>
			withBase(`/gallery/post-${post.id}/${f}`),
		);

		if (photos.length === 0) continue;

		albums.push({
			id: `post-${post.id}`,
			name: post.data.title,
			description: post.data.description || "",
			date: post.data.published
				? new Date(post.data.published).toISOString().split("T")[0]
				: undefined,
			tags: post.data.tags || [],
			cover: photos[0],
			photos,
		});
	}

	return albums;
}
