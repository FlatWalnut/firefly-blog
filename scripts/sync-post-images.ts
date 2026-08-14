/**
 * 为博客文章图片创建符号链接到相册目录
 * 用 symlink 代替复制，零磁盘重复
 */
import fs from "node:fs";
import path from "node:path";

const POSTS_DIR = path.join(process.cwd(), "src", "content", "posts");
const GALLERY_DIR = path.join(process.cwd(), "public", "gallery");

function syncPostImages() {
	if (!fs.existsSync(POSTS_DIR)) {
		console.log("Posts directory not found, skipping image sync.");
		return;
	}

	const entries = fs.readdirSync(POSTS_DIR, { withFileTypes: true });
	let syncedCount = 0;

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const postDir = path.join(POSTS_DIR, entry.name);
		const imagesDir = path.join(postDir, "images");

		if (!fs.existsSync(imagesDir)) continue;

		const images = fs
			.readdirSync(imagesDir)
			.filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f));

		if (images.length === 0) continue;

		const targetDir = path.join(GALLERY_DIR, `post-${entry.name}`);

		// 如果已存在，先删除再重建 symlink
		if (fs.existsSync(targetDir)) {
			fs.rmSync(targetDir, { recursive: true, force: true });
		}

		fs.mkdirSync(path.dirname(targetDir), { recursive: true });

		try {
			// 优先使用 symlink（零磁盘占用）
			fs.symlinkSync(imagesDir, targetDir, "junction");
			syncedCount++;
			console.log(
				`Linked ${images.length} image(s) from post "${entry.name}" (symlink).`,
			);
		} catch {
			// symlink 失败时回退到复制
			fs.mkdirSync(targetDir, { recursive: true });
			for (const image of images) {
				fs.copyFileSync(
					path.join(imagesDir, image),
					path.join(targetDir, image),
				);
			}
			syncedCount++;
			console.log(
				`Copied ${images.length} image(s) from post "${entry.name}" (fallback copy).`,
			);
		}
	}

	if (syncedCount === 0) {
		console.log("No post images to sync.");
	} else {
		console.log(`Synced images from ${syncedCount} post(s) to gallery.`);
	}
}

syncPostImages();
