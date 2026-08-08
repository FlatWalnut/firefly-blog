<script lang="ts">
import { onMount } from "svelte";

type View = "overview" | "posts" | "media" | "appearance" | "settings";
type Status = "published" | "draft";
type Post = {
	id: string;
	title: string;
	slug: string;
	status: Status;
	published: string;
	updated: string;
	description: string;
	tags: string[];
	category: string;
	cover: string;
	content: string;
	views: number;
	comments: number;
};
type Settings = {
	siteTitle: string;
	subtitle: string;
	description: string;
	author: string;
	announcement: string;
	desktopBg: string;
	mobileBg: string;
	accent: string;
};
type Media = { id: string; name: string; url: string; kind: "image" };
type GitHubStatus = "loading" | "disconnected" | "connected" | "publishing";

const PUBLISH_AFTER_AUTH_KEY = "firefly-publish-after-auth";

export let initialPosts: Post[] = [];
export let desktopWallpapers: string[] = [];
export let mobileWallpapers: string[] = [];

const navItems: { id: View; label: string; icon: string }[] = [
	{ id: "overview", label: "总览", icon: "⌂" },
	{ id: "posts", label: "文章管理", icon: "▤" },
	{ id: "media", label: "媒体库", icon: "▧" },
	{ id: "appearance", label: "外观设置", icon: "✦" },
	{ id: "settings", label: "站点设置", icon: "⚙" },
];

const fallbackDesktopWallpapers = [
	"/assets/images/DesktopWallpaper/d1.avif",
	"/assets/images/DesktopWallpaper/d2.avif",
	"/assets/images/DesktopWallpaper/d3.avif",
	"/assets/images/DesktopWallpaper/d4.avif",
	"/assets/images/DesktopWallpaper/d5.avif",
	"/assets/images/DesktopWallpaper/d6.avif",
];
const fallbackMobileWallpapers = [
	"/assets/images/MobileWallpaper/m1.avif",
	"/assets/images/MobileWallpaper/m2.avif",
	"/assets/images/MobileWallpaper/m3.avif",
	"/assets/images/MobileWallpaper/m4.avif",
	"/assets/images/MobileWallpaper/m5.avif",
	"/assets/images/MobileWallpaper/m6.avif",
];
const wallpaperOptions =
	desktopWallpapers.length > 0 ? desktopWallpapers : fallbackDesktopWallpapers;
const mobileWallpaperOptions =
	mobileWallpapers.length > 0 ? mobileWallpapers : fallbackMobileWallpapers;

const defaultSettings: Settings = {
	siteTitle: "Firefly",
	subtitle: "在微光里记录生活",
	description: "一个清新、自由、持续生长的个人博客。",
	author: "Firefly",
	announcement: "欢迎来到我的小站，愿每一次记录都能留下微光。",
	desktopBg: wallpaperOptions[0],
	mobileBg: mobileWallpaperOptions[0],
	accent: "#d278a3",
};

let view: View = "overview";
let posts: Post[] = initialPosts.map((post) => ({
	...post,
	status: post.status as Status,
}));
let settings: Settings = { ...defaultSettings };
let media: Media[] = [];
let search = "";
let statusFilter: "all" | Status = "all";
let categoryFilter = "all";
let mobileMenu = false;
let showEditor = false;
let editorMode: "new" | "edit" = "new";
let editor: Post = blankPost();
let showDelete = false;
let deletingId = "";
let toast = "";
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let uploadedFileInput: HTMLInputElement;
let backupFileInput: HTMLInputElement;
let githubStatus: GitHubStatus = "loading";
let githubLogin = "";
let githubConfigured = true;

function blankPost(): Post {
	return {
		id: `local-${Date.now()}`,
		title: "",
		slug: "",
		status: "draft",
		published: new Date().toISOString().slice(0, 10),
		updated: new Date().toISOString().slice(0, 10),
		description: "",
		tags: [],
		category: "随笔",
		cover: wallpaperOptions[1],
		content: "## 写下你的想法\n\n从这里开始创作……",
		views: 0,
		comments: 0,
	};
}

function normalizeBuiltInImage(value: string, fallback: string): string {
	const match = value.match(/\/(Desktop|Mobile)Wallpaper\/[dm](\d+)\.avif$/i);
	if (!match) return value;
	const index = Number(match[2]) - 1;
	const options =
		match[1].toLowerCase() === "mobile"
			? mobileWallpaperOptions
			: wallpaperOptions;
	return options[index] || fallback;
}

onMount(() => {
	try {
		const savedPosts = localStorage.getItem("firefly-admin-posts");
		const savedSettings = localStorage.getItem("firefly-admin-settings");
		const savedMedia = localStorage.getItem("firefly-admin-media");
		if (savedPosts) {
			posts = JSON.parse(savedPosts).map((post: Post) => ({
				...post,
				cover: normalizeBuiltInImage(post.cover, wallpaperOptions[0]),
			}));
		}
		if (savedSettings) {
			const parsedSettings = JSON.parse(savedSettings);
			settings = {
				...defaultSettings,
				...parsedSettings,
				desktopBg: normalizeBuiltInImage(
					parsedSettings.desktopBg || defaultSettings.desktopBg,
					defaultSettings.desktopBg,
				),
				mobileBg: normalizeBuiltInImage(
					parsedSettings.mobileBg || defaultSettings.mobileBg,
					defaultSettings.mobileBg,
				),
			};
		}
		if (savedMedia) media = JSON.parse(savedMedia);
	} catch {
		showToast("本地缓存读取失败，已使用默认数据");
	}
	void loadGitHubSession();
});

async function loadGitHubSession() {
	try {
		const response = await fetch("/api/auth/github/session", {
			headers: { Accept: "application/json" },
		});
		if (!response.ok)
			throw new Error(`GitHub session endpoint returned ${response.status}`);
		const data = (await response.json()) as {
			connected?: boolean;
			login?: string;
			configured?: boolean;
		};
		githubConfigured = data.configured !== false;
		githubStatus = data.connected ? "connected" : "disconnected";
		githubLogin = data.login || "";
		if (
			new URLSearchParams(window.location.search).get("github") === "connected"
		) {
			window.history.replaceState({}, "", window.location.pathname);
			showToast(`GitHub 已连接：${githubLogin}`);
		}
		const githubParams = new URLSearchParams(window.location.search);
		if (githubParams.get("github") === "error") {
			const messages: Record<string, string> = {
				"integration-access":
					"GitHub 应用无法访问目标仓库，请检查 App 安装范围和 Contents 写入权限后重新授权",
				"repository-read-only":
					"GitHub 已登录，但当前授权只有仓库读取权限，请授予写入权限后重新授权",
				"repository-unavailable":
					"当前 GitHub 授权无法访问目标仓库，请检查仓库名称和账号权限",
			};
			sessionStorage.removeItem(PUBLISH_AFTER_AUTH_KEY);
			window.history.replaceState({}, "", window.location.pathname);
			showToast(
				messages[githubParams.get("reason") || ""] ||
					"GitHub 授权未获得目标仓库写入权限，请重新授权",
			);
		}
		if (sessionStorage.getItem(PUBLISH_AFTER_AUTH_KEY) === "1") {
			sessionStorage.removeItem(PUBLISH_AFTER_AUTH_KEY);
			if (githubStatus === "connected") void publishToGitHub();
			else if (githubConfigured)
				window.location.href = "/api/auth/github/start";
		}
	} catch {
		githubStatus = "disconnected";
		githubConfigured = false;
	}
}

$: categories = Array.from(
	new Set(posts.map((post) => post.category).filter(Boolean)),
);
$: filteredPosts = posts.filter((post) => {
	const keyword = search.trim().toLowerCase();
	const matchesSearch =
		!keyword ||
		`${post.title} ${post.description} ${post.tags.join(" ")}`
			.toLowerCase()
			.includes(keyword);
	const matchesStatus = statusFilter === "all" || post.status === statusFilter;
	const matchesCategory =
		categoryFilter === "all" || post.category === categoryFilter;
	return matchesSearch && matchesStatus && matchesCategory;
});
$: publishedCount = posts.filter((post) => post.status === "published").length;
$: draftCount = posts.filter((post) => post.status === "draft").length;
$: totalViews = posts.reduce((sum, post) => sum + post.views, 0);
$: editorTags = editor.tags.join(", ");

function persist() {
	localStorage.setItem("firefly-admin-posts", JSON.stringify(posts));
	localStorage.setItem("firefly-admin-settings", JSON.stringify(settings));
	localStorage.setItem("firefly-admin-media", JSON.stringify(media));
	window.dispatchEvent(new CustomEvent("firefly-admin-sync"));
}

function showToast(message: string) {
	toast = message;
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (toast = ""), 2800);
}

function selectView(nextView: View) {
	view = nextView;
	mobileMenu = false;
}

function openNewPost() {
	editorMode = "new";
	editor = blankPost();
	showEditor = true;
}

function openEdit(post: Post) {
	editorMode = "edit";
	editor = { ...post, tags: [...post.tags] };
	showEditor = true;
}

function updateEditor<K extends keyof Post>(key: K, value: Post[K]) {
	editor = { ...editor, [key]: value };
}

function savePost() {
	if (!editor.title.trim()) {
		showToast("请先填写文章标题");
		return;
	}
	const cleanSlug = (editor.slug || editor.title)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
		.replace(/^-|-$/g, "");
	const saved = {
		...editor,
		slug: cleanSlug || `post-${Date.now()}`,
		updated: new Date().toISOString().slice(0, 10),
	};
	if (editorMode === "new") posts = [saved, ...posts];
	else posts = posts.map((post) => (post.id === saved.id ? saved : post));
	persist();
	showEditor = false;
	const shouldPublish = saved.status === "published";
	showToast(
		shouldPublish
			? "文章已保存，正在提交 GitHub"
			: editorMode === "new"
				? "文章已保存为草稿"
				: "文章已更新",
	);
	if (shouldPublish) void publishToGitHub();
}

function publishPost(post: Post) {
	posts = posts.map((item) =>
		item.id === post.id
			? {
					...item,
					status: "published",
					updated: new Date().toISOString().slice(0, 10),
				}
			: item,
	);
	persist();
	showToast("文章已标记为已发布，可继续导出并部署");
}

function askDelete(id: string) {
	deletingId = id;
	showDelete = true;
}

function confirmDelete() {
	posts = posts.filter((post) => post.id !== deletingId);
	persist();
	showDelete = false;
	showToast("文章已移入回收站");
}

function duplicatePost(post: Post) {
	posts = [
		{
			...post,
			id: `local-${Date.now()}`,
			title: `${post.title}（副本）`,
			slug: `${post.slug}-copy`,
			status: "draft",
			updated: new Date().toISOString().slice(0, 10),
			views: 0,
			comments: 0,
		},
		...posts,
	];
	persist();
	showToast("已创建文章副本");
}

function updateSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
	settings = { ...settings, [key]: value };
	persist();
	showToast("站点设置已保存");
}

function handleUpload(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = () => {
		media = [
			{
				id: `media-${Date.now()}`,
				name: file.name,
				url: String(reader.result),
				kind: "image",
			},
			...media,
		];
		persist();
		showToast("图片已加入本地媒体库");
	};
	reader.readAsDataURL(file);
	input.value = "";
}

function useMedia(url: string) {
	if (showEditor) updateEditor("cover", url);
	else updateSettings("desktopBg", url);
	showToast(showEditor ? "已设为封面图" : "已设为桌面背景");
}

function exportBackup() {
	const blob = new Blob([JSON.stringify({ posts, settings, media }, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `firefly-backup-${new Date().toISOString().slice(0, 10)}.json`;
	link.click();
	URL.revokeObjectURL(url);
	showToast("备份文件已下载");
}

async function importBackup(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	try {
		const raw = JSON.parse(await file.text()) as {
			posts?: unknown;
			settings?: unknown;
			media?: unknown;
		};
		if (!Array.isArray(raw.posts)) throw new Error("备份缺少文章列表");
		const importedPosts = raw.posts.map((value, index) => {
			if (!value || typeof value !== "object")
				throw new Error(`第 ${index + 1} 篇文章格式错误`);
			const post = value as Partial<Post>;
			return {
				id:
					typeof post.id === "string"
						? post.id
						: `imported-${Date.now()}-${index}`,
				title: typeof post.title === "string" ? post.title : "未命名文章",
				slug: typeof post.slug === "string" ? post.slug : `post-${index + 1}`,
				status:
					post.status === "published"
						? ("published" as const)
						: ("draft" as const),
				published:
					typeof post.published === "string"
						? post.published
						: new Date().toISOString().slice(0, 10),
				updated:
					typeof post.updated === "string"
						? post.updated
						: new Date().toISOString().slice(0, 10),
				description:
					typeof post.description === "string" ? post.description : "",
				tags: Array.isArray(post.tags)
					? post.tags.filter((tag): tag is string => typeof tag === "string")
					: [],
				category: typeof post.category === "string" ? post.category : "随笔",
				cover:
					typeof post.cover === "string" ? post.cover : wallpaperOptions[0],
				content: typeof post.content === "string" ? post.content : "",
				views: typeof post.views === "number" ? post.views : 0,
				comments: typeof post.comments === "number" ? post.comments : 0,
			};
		});
		const importedSettings =
			raw.settings && typeof raw.settings === "object"
				? (raw.settings as Partial<Settings>)
				: {};
		const importedMedia = Array.isArray(raw.media)
			? raw.media.filter((value): value is Media => {
					if (!value || typeof value !== "object") return false;
					const mediaItem = value as Partial<Media>;
					return (
						typeof mediaItem.name === "string" &&
						typeof mediaItem.url === "string" &&
						mediaItem.kind === "image"
					);
				})
			: [];
		posts = importedPosts;
		settings = { ...defaultSettings, ...importedSettings };
		media = importedMedia;
		persist();
		showToast(`已导入 ${posts.length} 篇文章，可继续发布`);
	} catch (error) {
		showToast(error instanceof Error ? error.message : "备份文件格式错误");
	} finally {
		input.value = "";
	}
}

async function publishToGitHub() {
	if (githubStatus === "loading") {
		sessionStorage.setItem(PUBLISH_AFTER_AUTH_KEY, "1");
		return;
	}
	if (githubStatus === "publishing") return;
	if (!githubConfigured) {
		showToast("线上 GitHub 配置未完成，请检查 Cloudflare Pages 环境变量");
		return;
	}
	if (githubStatus !== "connected") {
		sessionStorage.setItem(PUBLISH_AFTER_AUTH_KEY, "1");
		window.location.href = "/api/auth/github/start";
		return;
	}
	githubStatus = "publishing";
	try {
		const response = await fetch("/api/publish", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ backup: { posts, settings, media } }),
		});
		const result = (await response.json()) as { ok?: boolean; error?: string };
		if (!response.ok || !result.ok) throw new Error(result.error || "发布失败");
		githubStatus = "connected";
		showToast("已提交 GitHub，正在自动部署");
	} catch (error) {
		githubStatus = "connected";
		showToast(error instanceof Error ? error.message : "发布失败，请稍后重试");
	}
}

async function logoutGitHub() {
	await fetch("/api/auth/github/logout", { method: "POST" }).catch(
		() => undefined,
	);
	githubStatus = "disconnected";
	githubLogin = "";
	showToast("已退出 GitHub");
}

function clearLocalData() {
	if (
		!window.confirm(
			"确定要清除浏览器中的后台缓存吗？这不会删除源代码中的文章。",
		)
	)
		return;
	localStorage.removeItem("firefly-admin-posts");
	localStorage.removeItem("firefly-admin-settings");
	localStorage.removeItem("firefly-admin-media");
	posts = initialPosts.map((post) => ({
		...post,
		status: post.status as Status,
	}));
	settings = { ...defaultSettings };
	media = [];
	showToast("本地缓存已清除");
}
</script>

<svelte:head>
	<meta name="theme-color" content="#fbf8f6" />
</svelte:head>

<div class="admin-shell" style={`--accent:${settings.accent}`}>
	<div class:open={mobileMenu} class="mobile-overlay" on:click={() => (mobileMenu = false)}></div>
	<aside class:open={mobileMenu} class="sidebar">
		<div class="brand">
			<div class="brand-mark">✦</div>
			<div><strong>Firefly</strong><span>管理后台</span></div>
			<button class="sidebar-close" aria-label="关闭菜单" on:click={() => (mobileMenu = false)}>×</button>
		</div>
		<div class="workspace-switch"><span class="avatar">F</span><span><b>我的小站</b><small>个人博客</small></span><span class="chevron">⌄</span></div>
		<p class="nav-caption">WORKSPACE</p>
		<nav>
			{#each navItems as item}
				<button class:active={view === item.id} class="nav-item" on:click={() => selectView(item.id)}>
					<span class="nav-icon">{item.icon}</span>{item.label}
					{#if item.id === "posts"}<span class="nav-count">{posts.length}</span>{/if}
				</button>
			{/each}
		</nav>
		<div class="sidebar-bottom">
			<div class="deploy-mini"><span class="status-dot"></span><div><b>{githubStatus === "connected" ? "GitHub 同步已连接" : "GitHub 发布模式"}</b><small>{githubStatus === "connected" ? "发布后所有设备自动更新" : "连接 GitHub 后可同步到博客"}</small></div></div>
			<a class="back-blog" href="/"><span>↗</span> 返回博客首页</a>
		</div>
	</aside>

	<main class="main-area">
		<header class="topbar">
			<input class="hidden-input" bind:this={backupFileInput} type="file" accept=".json,application/json" on:change={importBackup} />
			<button class="mobile-menu-button" aria-label="打开菜单" on:click={() => (mobileMenu = true)}>☰</button>
			<div class="crumb"><span>我的小站</span><i>/</i><b>{navItems.find((item) => item.id === view)?.label}</b></div>
			<div class="topbar-actions">
				<button class="icon-button" title="预览博客" on:click={() => window.open("/", "_blank")}>◉</button>
				<button class="icon-button" title="导入备份" on:click={() => backupFileInput?.click()}>↑</button>
				<button class="icon-button" title="导出备份" on:click={exportBackup}>⇩</button>
				<div class="top-divider"></div>
				<div class="user-chip"><span class="avatar avatar-small">F</span><span class="user-name">Firefly</span><span class="chevron">⌄</span></div>
			</div>
		</header>

		<div class="page-content">
			{#if view === "overview"}
				<section class="welcome-row">
					<div><p class="eyebrow">{new Date().toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric" })}</p><h1>你好，Firefly <span>✦</span></h1><p class="subcopy">今天也写点什么吧，让想法在微光里慢慢生长。</p></div>
					<button class="primary-button" on:click={openNewPost}><span>＋</span> 写新文章</button>
				</section>
				<div class="stat-grid">
					<div class="stat-card"><div class="stat-top"><span>文章总数</span><span class="stat-icon pink">▤</span></div><strong>{posts.length}</strong><small><em>+{Math.min(posts.length, 3)}</em> 本月新增</small></div>
					<div class="stat-card"><div class="stat-top"><span>累计阅读</span><span class="stat-icon orange">◉</span></div><strong>{totalViews.toLocaleString()}</strong><small><em>+18.6%</em> 较上月</small></div>
					<div class="stat-card"><div class="stat-top"><span>已发布</span><span class="stat-icon green">✓</span></div><strong>{publishedCount}</strong><small>保持持续更新</small></div>
					<div class="stat-card"><div class="stat-top"><span>草稿箱</span><span class="stat-icon purple">✎</span></div><strong>{draftCount}</strong><small>等待你的灵感</small></div>
				</div>
				<div class="content-grid">
					<section class="panel recent-panel"><div class="panel-heading"><div><h2>最近文章</h2><p>你的内容正在持续发光</p></div><button class="text-button" on:click={() => selectView("posts")}>查看全部 <span>→</span></button></div>
						<div class="recent-list">{#each posts.slice(0, 5) as post}<button class="recent-item" on:click={() => { selectView("posts"); openEdit(post); }}><span class="post-thumb" style={`background-image:url('${post.cover}')`}></span><span class="recent-info"><b>{post.title}</b><small>{post.category} · {post.updated}</small></span><span class:published={post.status === "published"} class="status-pill">{post.status === "published" ? "已发布" : "草稿"}</span><span class="row-arrow">→</span></button>{/each}</div>
					</section>
					<section class="panel chart-panel"><div class="panel-heading"><div><h2>访问趋势</h2><p>最近 7 天的站点阅读量</p></div><span class="chart-total">+18.6% <small>↗</small></span></div><div class="chart"><div class="chart-y"><span>500</span><span>250</span><span>0</span></div><div class="chart-body"><div class="chart-lines"><i></i><i></i><i></i></div><svg viewBox="0 0 600 190" preserveAspectRatio="none" aria-label="访问趋势折线图"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path class="area" d="M0,150 C40,135 48,92 90,107 S150,139 180,110 S230,86 270,105 S330,54 370,75 S425,98 460,58 S520,62 550,30 S590,48 600,19 L600,190 L0,190 Z"/><path class="line" d="M0,150 C40,135 48,92 90,107 S150,139 180,110 S230,86 270,105 S330,54 370,75 S425,98 460,58 S520,62 550,30 S590,48 600,19"/>{#each [0, 90, 180, 270, 370, 460, 550, 600] as x}<circle cx={x} cy={x === 600 ? 19 : x === 550 ? 30 : x === 460 ? 58 : x === 370 ? 75 : x === 270 ? 105 : x === 180 ? 110 : x === 90 ? 107 : 150} r="4" />{/each}</svg><div class="chart-x"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div></div></section>
				</div>
				<div class="quick-row"><div class="quick-card accent-card"><div class="quick-orb">✦</div><div><b>把灵感记录下来</b><small>一篇好文章，从一个念头开始。</small></div><button on:click={openNewPost}>开始写作 <span>→</span></button></div><div class="quick-card"><div class="quick-icon">✎</div><div><b>完善你的博客外观</b><small>换一张喜欢的背景，让小站更像你。</small></div><button on:click={() => selectView("appearance")}>去设置 <span>→</span></button></div></div>
			{:else if view === "posts"}
				<section class="page-heading"><div><p class="eyebrow">CONTENT</p><h1>文章管理</h1><p class="subcopy">整理、编辑和发布你的每一篇文章。</p></div><button class="primary-button" on:click={openNewPost}><span>＋</span> 新建文章</button></section>
				<section class="panel posts-panel"><div class="toolbar"><div class="search-box"><span>⌕</span><input bind:value={search} placeholder="搜索文章标题、摘要或标签…" /></div><select bind:value={statusFilter}><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select><select bind:value={categoryFilter}><option value="all">全部分类</option>{#each categories as category}<option value={category}>{category}</option>{/each}</select><span class="result-count">共 {filteredPosts.length} 篇</span></div><div class="table-wrap"><table><thead><tr><th>文章</th><th>分类</th><th>状态</th><th>更新时间</th><th>阅读</th><th></th></tr></thead><tbody>{#each filteredPosts as post}<tr><td><div class="table-post"><span class="post-thumb" style={`background-image:url('${post.cover}')`}></span><div><b>{post.title}</b><small>/posts/{post.slug}</small></div></div></td><td><span class="category-label">{post.category}</span></td><td><span class:published={post.status === "published"} class="status-pill">{post.status === "published" ? "已发布" : "草稿"}</span></td><td>{post.updated}</td><td>{post.views}</td><td><div class="row-actions"><button title="编辑" on:click={() => openEdit(post)}>✎</button><button title="复制" on:click={() => duplicatePost(post)}>⧉</button><button title="删除" class="danger-text" on:click={() => askDelete(post.id)}>⌫</button></div></td></tr>{:else}<tr><td colspan="6" class="empty-cell">没有找到符合条件的文章。</td></tr>{/each}</tbody></table></div><div class="mobile-post-list">{#each filteredPosts as post}<article class="mobile-post-card"><div class="table-post"><span class="post-thumb" style={`background-image:url('${post.cover}')`}></span><div><b>{post.title}</b><small>{post.category} · {post.updated}</small></div></div><div class="mobile-post-meta"><span class:published={post.status === "published"} class="status-pill">{post.status === "published" ? "已发布" : "草稿"}</span><span>{post.views} 阅读</span><div class="row-actions"><button on:click={() => openEdit(post)}>✎</button><button on:click={() => askDelete(post.id)}>⌫</button></div></div></article>{/each}</div></section>
			{:else if view === "media"}
				<section class="page-heading"><div><p class="eyebrow">ASSETS</p><h1>媒体库</h1><p class="subcopy">管理封面、背景和博客里的视觉素材。</p></div><button class="primary-button" on:click={() => uploadedFileInput?.click()}><span>＋</span> 上传图片</button></section>
				<input class="hidden-input" bind:this={uploadedFileInput} type="file" accept="image/*" on:change={handleUpload} />
				<div class="media-tabs"><button class="active">全部素材</button><span>{wallpaperOptions.length + mobileWallpaperOptions.length + media.length} 个文件</span><small>建议使用 WebP / AVIF，加载更快</small></div>
				<section class="media-grid">{#each [...wallpaperOptions.map((url, i) => ({ id: `desktop-${i}`, name: `desktop-wallpaper-${i + 1}.avif`, url, kind: "image" as const })), ...mobileWallpaperOptions.map((url, i) => ({ id: `mobile-${i}`, name: `mobile-wallpaper-${i + 1}.avif`, url, kind: "image" as const })), ...media] as item}<article class="media-card"><div class="media-preview" style={`background-image:url('${item.url}')`}><span class="media-type">IMAGE</span><div class="media-hover"><button on:click={() => useMedia(item.url)}>使用图片</button></div></div><div class="media-info"><b>{item.name}</b><small>{item.id.startsWith("mobile") ? "移动端背景" : item.id.startsWith("desktop") ? "桌面端背景" : "本地上传"}</small></div></article>{/each}</section>
			{:else if view === "appearance"}
				<section class="page-heading"><div><p class="eyebrow">CUSTOMIZE</p><h1>外观设置</h1><p class="subcopy">让博客的每一处细节，都带上你的个人气质。</p></div><span class="saved-label">● 自动保存</span></section>
				<div class="appearance-layout"><section class="panel form-panel"><div class="panel-heading"><div><h2>背景与色彩</h2><p>桌面端和移动端可以使用不同的壁纸。</p></div></div><label>桌面端背景</label><div class="select-cards">{#each wallpaperOptions as url, i}<button class:selected={settings.desktopBg === url} class="wallpaper-choice" style={`background-image:url('${url}')`} on:click={() => updateSettings("desktopBg", url)}><span>{#if settings.desktopBg === url}✓{/if}</span><small>D{i + 1}</small></button>{/each}</div><label>移动端背景</label><div class="select-cards mobile-select">{#each mobileWallpaperOptions as url, i}<button class:selected={settings.mobileBg === url} class="wallpaper-choice" style={`background-image:url('${url}')`} on:click={() => updateSettings("mobileBg", url)}><span>{#if settings.mobileBg === url}✓{/if}</span><small>M{i + 1}</small></button>{/each}</div><label for="desktop-url">自定义桌面背景 URL</label><input id="desktop-url" class="form-input" value={settings.desktopBg} on:change={(event) => updateSettings("desktopBg", (event.currentTarget as HTMLInputElement).value)} placeholder="https://…" /><label for="accent">主题强调色</label><div class="color-row"><input id="accent" type="color" value={settings.accent} on:input={(event) => updateSettings("accent", (event.currentTarget as HTMLInputElement).value)} /><span>{settings.accent}</span><small>用于按钮、链接和图表高亮</small></div></section><section class="panel preview-panel"><div class="panel-heading"><div><h2>实时预览</h2><p>看看它在博客首页的样子。</p></div><span class="preview-device">桌面端</span></div><div class="site-preview" style={`background-image:linear-gradient(180deg,rgba(30,20,35,.08),rgba(30,20,35,.7)),url('${settings.desktopBg}')`}><div class="preview-nav"><b>✦ {settings.siteTitle}</b><span>首页　归档　关于</span><i>☰</i></div><div class="preview-center"><span>WELCOME TO MY BLOG</span><strong>{settings.subtitle}</strong><small>{settings.announcement}</small><button>探索文章　→</button></div></div></section></div>
			{:else if view === "settings"}
				<section class="page-heading"><div><p class="eyebrow">CONFIGURATION</p><h1>站点设置</h1><p class="subcopy">管理博客信息、发布工具和本地数据。</p></div></section>
				<div class="settings-layout"><section class="panel settings-form"><div class="panel-heading"><div><h2>基本信息</h2><p>这些内容会显示在博客首页和 SEO 信息中。</p></div></div><label for="site-title">站点名称</label><input id="site-title" class="form-input" value={settings.siteTitle} on:change={(event) => updateSettings("siteTitle", (event.currentTarget as HTMLInputElement).value)} /><label for="subtitle">站点副标题</label><input id="subtitle" class="form-input" value={settings.subtitle} on:change={(event) => updateSettings("subtitle", (event.currentTarget as HTMLInputElement).value)} /><label for="author">作者名称</label><input id="author" class="form-input" value={settings.author} on:change={(event) => updateSettings("author", (event.currentTarget as HTMLInputElement).value)} /><label for="description">站点描述</label><textarea id="description" class="form-input textarea-small" on:change={(event) => updateSettings("description", (event.currentTarget as HTMLTextAreaElement).value)}>{settings.description}</textarea><label for="announcement">首页公告</label><textarea id="announcement" class="form-input textarea-small" on:change={(event) => updateSettings("announcement", (event.currentTarget as HTMLTextAreaElement).value)}>{settings.announcement}</textarea></section><section class="settings-side"><div class="panel publish-panel"><div class="publish-mark">↗</div><h2>发布到线上</h2><p>发布会把文章、设置和图片转换为源码，提交到 GitHub 后由 Actions 自动部署。</p>{#if githubStatus === "connected"}<button class="primary-button wide" on:click={publishToGitHub}>发布到 GitHub <span>→</span></button><button class="secondary-button wide" on:click={logoutGitHub}>退出 GitHub（{githubLogin}）</button>{:else if githubStatus === "publishing"}<button class="primary-button wide" disabled>正在提交 GitHub…</button>{:else if githubStatus === "loading"}<button class="secondary-button wide" disabled>检查 GitHub 连接…</button>{:else if githubConfigured}<a href="/api/auth/github/start" class="primary-button wide">连接 GitHub <span>→</span></a>{:else}<button class="secondary-button wide" on:click={() => showToast("线上 GitHub 配置未完成，请检查 Cloudflare Pages 环境变量")}>GitHub 配置未完成</button>{/if}<button class="secondary-button wide" on:click={exportBackup}>导出内容备份 <span>↓</span></button><a href="https://github.com/FlatWalnut/firefly-blog" target="_blank" rel="noreferrer" class="secondary-button wide">打开 GitHub 仓库 ↗</a><div class="publish-note"><span>●</span>{githubStatus === "connected" ? `已连接 ${githubLogin}` : "未连接 GitHub 账号，Token 只保存在服务端会话中"}</div></div><div class="panel danger-panel"><h3>数据管理</h3><p>清除本地缓存会恢复为源代码中的初始数据。</p><button class="danger-button" on:click={clearLocalData}>清除本地缓存</button></div></section></div>
			{/if}
		</div>
	</main>

	{#if showEditor}
		<div class="modal-backdrop" on:click={(event) => event.target === event.currentTarget && (showEditor = false)}><section class="editor-modal"><div class="editor-head"><div><p class="eyebrow">{editorMode === "new" ? "NEW STORY" : "EDIT STORY"}</p><h2>{editorMode === "new" ? "写一篇新文章" : "编辑文章"}</h2></div><button class="modal-close" aria-label="关闭" on:click={() => (showEditor = false)}>×</button></div><div class="editor-body"><div class="editor-main"><label for="post-title">标题 <em>*</em></label><input id="post-title" class="form-input title-input" value={editor.title} on:input={(event) => updateEditor("title", (event.currentTarget as HTMLInputElement).value)} placeholder="给文章起一个好名字" /><div class="two-fields"><div><label for="post-slug">URL 别名</label><input id="post-slug" class="form-input" value={editor.slug} on:input={(event) => updateEditor("slug", (event.currentTarget as HTMLInputElement).value)} placeholder="留空自动生成" /></div><div><label for="post-category">分类</label><input id="post-category" class="form-input" value={editor.category} on:input={(event) => updateEditor("category", (event.currentTarget as HTMLInputElement).value)} placeholder="如：随笔" /></div></div><label for="post-description">摘要</label><textarea id="post-description" class="form-input textarea-small" value={editor.description} on:input={(event) => updateEditor("description", (event.currentTarget as HTMLTextAreaElement).value)} placeholder="用一两句话介绍这篇文章"></textarea><label for="post-content">正文（Markdown）</label><textarea id="post-content" class="form-input markdown-editor" value={editor.content} on:input={(event) => updateEditor("content", (event.currentTarget as HTMLTextAreaElement).value)}></textarea></div><aside class="editor-side"><div><label for="post-status">发布状态</label><select id="post-status" class="form-input" value={editor.status} on:change={(event) => updateEditor("status", (event.currentTarget as HTMLSelectElement).value as Status)}><option value="draft">保存为草稿</option><option value="published">立即发布</option></select></div><div><label for="post-tags">标签</label><input id="post-tags" class="form-input" value={editorTags} on:input={(event) => updateEditor("tags", (event.currentTarget as HTMLInputElement).value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="生活, 阅读, 技术" /><small class="field-hint">使用英文逗号分隔</small></div><div><label>封面图</label><div class="cover-picker" style={`background-image:linear-gradient(180deg,transparent,rgba(0,0,0,.55)),url('${editor.cover}')`}><button on:click={() => selectView("media")}>从媒体库选择</button></div><input class="form-input" value={editor.cover} on:change={(event) => updateEditor("cover", (event.currentTarget as HTMLInputElement).value)} placeholder="图片 URL" /></div><div class="editor-tip"><span>✦</span><p>支持 Markdown。发布前建议先检查摘要、封面图和 URL 别名。</p></div></aside></div><div class="editor-foot"><button class="secondary-button" on:click={() => (showEditor = false)}>取消</button><button class="primary-button" on:click={savePost}>{editor.status === "published" ? "保存并发布" : "保存草稿"} <span>→</span></button></div></section></div>
	{/if}
	{#if showDelete}<div class="modal-backdrop"><section class="confirm-modal"><div class="confirm-icon">⌫</div><h2>删除这篇文章？</h2><p>文章会从后台列表中移除。建议先导出备份，以免误删。</p><div class="confirm-actions"><button class="secondary-button" on:click={() => (showDelete = false)}>取消</button><button class="danger-button" on:click={confirmDelete}>确认删除</button></div></section></div>{/if}
	{#if toast}<div class="toast"><span>✓</span>{toast}</div>{/if}
</div>

<style>
	:global(*) { box-sizing: border-box; }
	:global(html), :global(body) { margin: 0; min-width: 320px; background: #fbf8f6; color: #3e3740; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; }
	:global(button), :global(input), :global(select), :global(textarea) { font: inherit; }
	:global(button) { cursor: pointer; }
	:global(a) { color: inherit; text-decoration: none; }
	.admin-shell { --accent: #d278a3; --ink: #3e3740; --muted: #948991; --line: #eee6e3; --panel: rgba(255,255,255,.8); min-height: 100vh; background: radial-gradient(circle at 90% 0%, rgba(239, 214, 227, .26), transparent 24rem), #fbf8f6; }
	.sidebar { position: fixed; z-index: 20; inset: 0 auto 0 0; width: 244px; padding: 27px 16px 18px; display: flex; flex-direction: column; background: rgba(255,255,255,.72); border-right: 1px solid rgba(225,215,214,.78); backdrop-filter: blur(22px); }
	.brand { display: flex; align-items: center; gap: 11px; padding: 0 10px 28px; color: var(--ink); }
	.brand-mark { width: 33px; height: 33px; display: grid; place-items: center; color: white; background: linear-gradient(140deg, #da96bb, #b88ecb); border-radius: 12px 12px 12px 4px; box-shadow: 0 8px 18px rgba(200,133,172,.23); }
	.brand strong { display:block; font: 700 19px Georgia, serif; letter-spacing: .02em; }
	.brand span { display:block; color: var(--muted); font-size: 10px; letter-spacing: .16em; margin-top: 2px; }
	.sidebar-close { display:none; margin-left:auto; border:0; color:var(--muted); background:none; font-size:24px; }
	.workspace-switch { display:flex; align-items:center; gap:9px; padding:10px; margin:0 0 27px; background:rgba(247,242,241,.8); border:1px solid #eee7e5; border-radius:14px; font-size:12px; }
	.avatar { display:grid; place-items:center; flex:0 0 auto; width:30px; height:30px; color:white; background:linear-gradient(145deg,#e1a3b8,#a995d0); border-radius:10px; font-weight:700; }
	.avatar-small { width:29px; height:29px; border-radius:50%; }
	.workspace-switch b, .workspace-switch small { display:block; }
	.workspace-switch small { color:var(--muted); font-size:10px; margin-top:3px; }
	.chevron { color:#b7aaae; margin-left:auto; }
	.nav-caption { padding:0 13px; margin:0 0 9px; color:#b7abad; font-size:10px; font-weight:700; letter-spacing:.16em; }
	nav { display:grid; gap:4px; }
	.nav-item { display:flex; align-items:center; gap:12px; width:100%; padding:11px 13px; border:0; border-radius:12px; color:#877b82; background:transparent; text-align:left; font-size:13px; transition:.2s; }
	.nav-item:hover { color:var(--ink); background:#f7f0f1; }
	.nav-item.active { color:#b65c88; background:linear-gradient(100deg,#f8e9ee,#f8f1f5); font-weight:700; box-shadow:inset 3px 0 0 var(--accent); }
	.nav-icon { width:18px; color:inherit; text-align:center; font-size:18px; line-height:1; }
	.nav-count { margin-left:auto; min-width:21px; padding:2px 5px; border-radius:9px; background:#f1e4e9; color:#bd718f; font-size:10px; text-align:center; }
	.sidebar-bottom { margin-top:auto; }
	.deploy-mini { display:flex; gap:9px; align-items:center; padding:12px 10px; margin:0 3px 14px; border-top:1px solid var(--line); }
	.status-dot { width:7px; height:7px; background:#74bf9d; border-radius:50%; box-shadow:0 0 0 4px #e1f1e8; }
	.deploy-mini b, .deploy-mini small { display:block; font-size:11px; }
	.deploy-mini small { color:var(--muted); font-size:10px; margin-top:3px; }
	.back-blog { display:flex; align-items:center; gap:10px; padding:10px 13px; color:#9d8e94; font-size:12px; border-radius:10px; }
	.back-blog:hover { color:var(--accent); background:#faf2f4; }
	.main-area { margin-left:244px; min-height:100vh; }
	.topbar { position:sticky; top:0; z-index:10; height:77px; display:flex; align-items:center; justify-content:space-between; padding:0 46px; border-bottom:1px solid rgba(231,222,220,.65); background:rgba(251,248,246,.72); backdrop-filter:blur(18px); }
	.crumb { color:#b2a5aa; font-size:12px; }.crumb i { padding:0 11px; color:#d2c5c7; font-style:normal; }.crumb b { color:#675b62; font-weight:600; }
	.topbar-actions { display:flex; align-items:center; gap:9px; }.icon-button { width:31px; height:31px; display:grid; place-items:center; color:#9e9096; border:0; border-radius:9px; background:transparent; }.icon-button:hover { background:#f4eaed; color:var(--accent); }.top-divider { width:1px; height:23px; margin:0 8px; background:#e6dede; }.user-chip { display:flex; align-items:center; gap:8px; color:#6e6268; font-size:12px; }.user-chip .chevron { margin-left:1px; }.mobile-menu-button { display:none; border:0; background:none; color:#6e6268; font-size:21px; }
	.page-content { max-width:1360px; padding:42px 52px 70px; margin:auto; }.welcome-row,.page-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:29px; }.eyebrow { margin:0 0 8px; color:#c485a2; font-size:10px; font-weight:800; letter-spacing:.2em; }.welcome-row h1,.page-heading h1 { margin:0; color:#40383f; font:700 29px Georgia, serif; letter-spacing:-.02em; }.welcome-row h1 span { color:var(--accent); font-family: sans-serif; font-size:22px; }.subcopy { margin:9px 0 0; color:#a09398; font-size:12px; }.primary-button,.secondary-button,.danger-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:40px; padding:0 17px; border:1px solid transparent; border-radius:11px; font-size:12px; font-weight:700; transition:.2s; }.primary-button { color:white; background:linear-gradient(135deg,#d986ab,#bd82bf); box-shadow:0 8px 17px rgba(205,128,166,.2); }.primary-button:hover { transform:translateY(-1px); box-shadow:0 11px 22px rgba(205,128,166,.28); }.primary-button span { font-size:17px; font-weight:400; }.secondary-button { color:#83757d; background:white; border-color:#e9dfde; }.secondary-button:hover { color:var(--accent); border-color:#dbb0c2; }.danger-button { color:#bd5c6b; background:#fff1f1; border-color:#f5d7d8; }.danger-button:hover { background:#fbdfe1; }.wide { width:100%; margin-top:10px; }.saved-label { padding:7px 11px; border-radius:20px; color:#6eaa8d; background:#eef8f1; font-size:11px; }
	.stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:15px; margin-bottom:17px; }.stat-card,.panel,.quick-card { border:1px solid rgba(233,224,222,.9); background:var(--panel); box-shadow:0 10px 30px rgba(117,87,95,.035); border-radius:17px; }.stat-card { padding:18px 20px; }.stat-top { display:flex; align-items:center; justify-content:space-between; color:#968a8f; font-size:11px; }.stat-card strong { display:block; margin:12px 0 7px; color:#473d44; font:700 27px Georgia,serif; }.stat-card small { color:#ada2a5; font-size:10px; }.stat-card small em { margin-right:4px; color:#68ab86; font-style:normal; font-weight:700; }.stat-icon { display:grid; place-items:center; width:29px; height:29px; border-radius:9px; font-size:15px; }.pink { color:#bf7393; background:#f9e9ef; }.orange { color:#ce9a62; background:#fff1df; }.green { color:#71ab8e; background:#e6f4eb; }.purple { color:#9981be; background:#f0e9f8; }
	.content-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:17px; }.panel { padding:24px; }.panel-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:15px; margin-bottom:18px; }.panel-heading h2 { margin:0; color:#4b4249; font:700 17px Georgia,serif; }.panel-heading p { margin:6px 0 0; color:#aaa0a3; font-size:11px; }.text-button { border:0; background:none; color:#bd7895; font-size:11px; white-space:nowrap; }.text-button:hover { color:#9e4f72; }.recent-list { display:grid; }.recent-item { display:flex; align-items:center; gap:12px; min-width:0; padding:12px 0; border:0; border-top:1px solid #f2ebea; background:none; color:inherit; text-align:left; }.recent-item:first-child { border-top:0; padding-top:0; }.recent-item:last-child { padding-bottom:0; }.recent-item:hover b { color:var(--accent); }.post-thumb { flex:0 0 auto; display:inline-block; width:39px; height:39px; border-radius:11px; background-position:center; background-size:cover; box-shadow:inset 0 0 0 1px rgba(255,255,255,.25); }.recent-info,.table-post>div { min-width:0; flex:1; }.recent-info b,.table-post b { display:block; overflow:hidden; color:#645961; font-size:12px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }.recent-info small,.table-post small { display:block; overflow:hidden; margin-top:5px; color:#ada2a5; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }.status-pill { display:inline-block; flex:0 0 auto; padding:5px 8px; border-radius:8px; color:#b28693; background:#f7e9ed; font-size:10px; white-space:nowrap; }.status-pill.published { color:#68a282; background:#eaf6ee; }.row-arrow { color:#d0c2c5; }.chart-total { color:#70aa8c; font-size:11px; }.chart-total small { font-size:14px; }.chart { display:flex; height:220px; }.chart-y { display:flex; flex-direction:column; justify-content:space-between; padding:8px 10px 27px 0; color:#b9adb0; font-size:9px; }.chart-body { position:relative; flex:1; min-width:0; }.chart-lines { position:absolute; inset:8px 0 27px; display:flex; flex-direction:column; justify-content:space-between; }.chart-lines i { border-top:1px dashed #ede4e3; }.chart-body svg { position:absolute; inset:8px 0 27px; width:100%; height:calc(100% - 35px); overflow:visible; }.chart-body svg .area { fill:url(#area); }.chart-body svg .line { fill:none; stroke:var(--accent); stroke-width:3; stroke-linecap:round; }.chart-body svg circle { fill:white; stroke:var(--accent); stroke-width:2; }.chart-x { position:absolute; bottom:0; left:0; right:0; display:flex; justify-content:space-between; color:#b9adb0; font-size:9px; }.quick-row { display:grid; grid-template-columns:1fr 1fr; gap:17px; margin-top:17px; }.quick-card { display:flex; align-items:center; gap:14px; padding:17px 19px; }.quick-orb,.quick-icon { flex:0 0 auto; display:grid; place-items:center; width:38px; height:38px; border-radius:13px; color:#bc7293; background:#fae9ef; font-size:18px; }.quick-icon { color:#967fba; background:#eee9f8; }.quick-card div:not(.quick-orb):not(.quick-icon) { flex:1; }.quick-card b,.quick-card small { display:block; }.quick-card b { color:#665a60; font-size:12px; }.quick-card small { margin-top:5px; color:#aaa0a4; font-size:10px; }.quick-card button { border:0; color:#ba7391; background:none; font-size:11px; white-space:nowrap; }.quick-card button span { margin-left:3px; font-size:15px; }.accent-card { background:linear-gradient(105deg,#fffafa,#fdf4f6); }
	.posts-panel { padding:0; overflow:hidden; }.toolbar { display:flex; align-items:center; gap:10px; padding:17px 19px; border-bottom:1px solid var(--line); }.search-box { display:flex; align-items:center; flex:1; max-width:380px; height:35px; padding:0 11px; border:1px solid #ece3e1; border-radius:9px; background:#fff; }.search-box span { color:#b4a6aa; font-size:19px; }.search-box input { width:100%; padding-left:7px; border:0; outline:0; color:#5f545a; background:transparent; font-size:11px; }.search-box input::placeholder { color:#bdb2b4; }.toolbar select { height:35px; padding:0 10px; border:1px solid #ece3e1; border-radius:9px; outline:0; color:#897b81; background:#fff; font-size:11px; }.result-count { margin-left:auto; color:#ada1a4; font-size:11px; }.table-wrap { overflow-x:auto; }table { width:100%; border-collapse:collapse; min-width:760px; }th { padding:13px 19px; color:#ada0a4; background:#fdfafa; font-size:10px; font-weight:600; text-align:left; }td { padding:14px 19px; border-top:1px solid #f1e9e8; color:#988b90; font-size:11px; white-space:nowrap; }.table-post { display:flex; align-items:center; gap:11px; max-width:330px; }.table-post .post-thumb { width:43px; height:39px; }.row-actions { display:flex; gap:2px; justify-content:flex-end; }.row-actions button { width:28px; height:28px; border:0; border-radius:8px; color:#aa9ca0; background:transparent; }.row-actions button:hover { color:var(--accent); background:#f9edef; }.row-actions button.danger-text:hover { color:#c2606c; background:#fff0f0; }.empty-cell { padding:45px; color:#a99ca0; text-align:center; }.mobile-post-list { display:none; }
	.media-tabs { display:flex; align-items:center; gap:14px; margin:0 0 18px; color:#a09297; font-size:11px; }.media-tabs button { padding:7px 12px; border:0; border-radius:9px; color:var(--accent); background:#faeaf0; font-size:11px; }.media-tabs small { margin-left:auto; color:#b8adaf; }.media-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }.media-card { overflow:hidden; border:1px solid #ebe2e1; border-radius:15px; background:rgba(255,255,255,.76); }.media-preview { position:relative; height:150px; background-position:center; background-size:cover; }.media-type { position:absolute; top:9px; left:9px; padding:4px 6px; color:white; border-radius:5px; background:rgba(30,20,30,.35); font-size:8px; letter-spacing:.08em; }.media-hover { position:absolute; inset:0; display:grid; place-items:center; opacity:0; background:rgba(50,31,44,.3); transition:.2s; }.media-preview:hover .media-hover { opacity:1; }.media-hover button { padding:8px 11px; border:0; border-radius:8px; color:#71525f; background:#fff; font-size:10px; }.media-info { padding:11px 12px; }.media-info b,.media-info small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.media-info b { color:#695d63; font-size:11px; font-weight:600; }.media-info small { margin-top:5px; color:#b1a4a7; font-size:9px; }.hidden-input { display:none; }
	.appearance-layout,.settings-layout { display:grid; grid-template-columns:1fr 1fr; gap:18px; }.form-panel label,.settings-form label,.editor-main label,.editor-side label { display:block; margin:20px 0 8px; color:#81747b; font-size:11px; font-weight:700; }.form-panel label:first-of-type,.settings-form label:first-of-type,.editor-main label:first-of-type { margin-top:0; }.select-cards { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:22px; }.wallpaper-choice { position:relative; height:70px; padding:0; border:2px solid transparent; border-radius:10px; background-position:center; background-size:cover; overflow:hidden; }.wallpaper-choice:hover,.wallpaper-choice.selected { border-color:var(--accent); }.wallpaper-choice span { position:absolute; top:5px; right:5px; display:grid; place-items:center; width:17px; height:17px; border-radius:50%; color:white; background:var(--accent); font-size:10px; }.wallpaper-choice small { position:absolute; left:7px; bottom:5px; color:white; text-shadow:0 1px 3px #333; font-size:9px; }.mobile-select .wallpaper-choice { height:82px; }.form-input { width:100%; min-height:39px; padding:9px 11px; border:1px solid #ece3e1; border-radius:9px; outline:0; color:#685b62; background:#fff; font-size:11px; }.form-input:focus { border-color:#dbaec2; box-shadow:0 0 0 3px #faeaf0; }.textarea-small { min-height:78px; resize:vertical; }.color-row { display:flex; align-items:center; gap:10px; color:#82747b; font-size:11px; }.color-row input { width:37px; height:31px; padding:2px; border:1px solid #e9dfdd; border-radius:8px; background:white; }.color-row small { color:#b3a7aa; }.preview-device { padding:6px 9px; color:#a19197; border:1px solid #eee4e2; border-radius:8px; font-size:9px; }.site-preview { position:relative; height:390px; overflow:hidden; background-position:center; background-size:cover; border-radius:14px; }.preview-nav { display:flex; align-items:center; justify-content:space-between; padding:16px 19px; color:rgba(255,255,255,.9); font-size:11px; }.preview-nav b { font:700 15px Georgia,serif; }.preview-nav i { display:none; }.preview-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px; color:white; text-align:center; }.preview-center span { margin-bottom:12px; opacity:.76; font-size:9px; letter-spacing:.2em; }.preview-center strong { font:700 31px Georgia,serif; text-shadow:0 2px 12px rgba(0,0,0,.2); }.preview-center small { max-width:250px; margin-top:15px; opacity:.82; font-size:11px; line-height:1.7; }.preview-center button { margin-top:23px; padding:9px 13px; color:#725866; border:0; border-radius:9px; background:rgba(255,255,255,.88); font-size:10px; }
	.settings-form,.publish-panel,.danger-panel { padding:25px; }.settings-form .panel-heading { margin-bottom:23px; }.settings-side { display:grid; align-content:start; gap:18px; }.publish-panel { background:linear-gradient(145deg,#fffafd,#f8f1f7); }.publish-mark { display:grid; place-items:center; width:44px; height:44px; color:#bd7296; border-radius:14px; background:#f9e7ef; font-size:23px; }.publish-panel h2 { margin:19px 0 8px; color:#594b53; font:700 20px Georgia,serif; }.publish-panel p,.danger-panel p { margin:0; color:#a19499; font-size:11px; line-height:1.8; }.publish-note { display:flex; align-items:center; gap:7px; margin-top:16px; color:#a8999e; font-size:10px; }.publish-note span { color:#70ac8a; }.danger-panel h3 { margin:0 0 7px; color:#665960; font:700 15px Georgia,serif; }.danger-panel .danger-button { margin-top:17px; }
	.modal-backdrop { position:fixed; z-index:50; inset:0; display:grid; place-items:center; padding:22px; background:rgba(56,38,50,.28); backdrop-filter:blur(6px); }.editor-modal { width:min(890px,100%); max-height:calc(100vh - 44px); overflow:auto; border:1px solid rgba(255,255,255,.8); border-radius:20px; background:#fdfafa; box-shadow:0 25px 70px rgba(54,33,48,.2); }.editor-head { display:flex; align-items:flex-start; justify-content:space-between; padding:25px 28px 20px; border-bottom:1px solid #f0e7e6; }.editor-head h2,.confirm-modal h2 { margin:0; color:#4f444b; font:700 22px Georgia,serif; }.modal-close { border:0; background:none; color:#b5a5aa; font-size:25px; }.editor-body { display:grid; grid-template-columns:1fr 280px; gap:28px; padding:25px 28px; }.editor-main label { margin-top:19px; }.editor-main label em { color:#c76e8d; font-style:normal; }.title-input { min-height:47px; font-size:16px; }.two-fields { display:grid; grid-template-columns:1fr 1fr; gap:12px; }.markdown-editor { min-height:250px; resize:vertical; line-height:1.7; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; }.editor-side { padding-left:22px; border-left:1px solid #f0e7e6; }.editor-side label { margin-top:17px; }.field-hint { display:block; margin-top:6px; color:#afa1a5; font-size:9px; }.cover-picker { height:130px; display:grid; place-items:center; margin-bottom:9px; border-radius:11px; background-position:center; background-size:cover; }.cover-picker button { padding:8px 11px; border:0; border-radius:8px; color:#705a65; background:rgba(255,255,255,.9); font-size:10px; }.editor-tip { display:flex; gap:8px; margin-top:23px; padding:11px; border-radius:10px; color:#a08f96; background:#fbf2f5; font-size:10px; line-height:1.6; }.editor-tip span { color:var(--accent); }.editor-tip p { margin:0; }.editor-foot { display:flex; justify-content:flex-end; gap:9px; padding:17px 28px; border-top:1px solid #f0e7e6; background:#fff; }.confirm-modal { width:min(390px,100%); padding:30px; border-radius:18px; background:#fffafa; text-align:center; }.confirm-icon { display:grid; place-items:center; width:48px; height:48px; margin:0 auto 17px; color:#bd6977; border-radius:15px; background:#fff0f0; font-size:22px; }.confirm-modal p { color:#a4969b; font-size:11px; line-height:1.8; }.confirm-actions { display:flex; justify-content:center; gap:9px; margin-top:24px; }.toast { position:fixed; z-index:80; right:28px; bottom:26px; display:flex; align-items:center; gap:9px; padding:12px 16px; color:#68545d; border:1px solid #eadce0; border-radius:11px; background:#fff; box-shadow:0 12px 30px rgba(69,38,56,.14); font-size:11px; }.toast span { display:grid; place-items:center; width:18px; height:18px; color:white; border-radius:50%; background:#75b394; font-size:11px; }
	.mobile-overlay { display:none; }
	@media (max-width: 1100px) { .page-content { padding-inline:31px; }.topbar { padding-inline:31px; }.media-grid { grid-template-columns:repeat(3,1fr); }.content-grid { grid-template-columns:1fr; }.chart-panel { min-height:280px; } }
	@media (max-width: 780px) { .sidebar { transform:translateX(-100%); transition:transform .25s ease; box-shadow:15px 0 35px rgba(64,39,51,.12); }.sidebar.open { transform:translateX(0); }.sidebar-close { display:block; }.mobile-overlay { position:fixed; z-index:19; inset:0; background:rgba(50,30,44,.24); }.mobile-overlay.open { display:block; }.main-area { margin-left:0; }.topbar { height:63px; padding:0 17px; }.mobile-menu-button { display:block; }.crumb { margin-right:auto; margin-left:13px; }.topbar-actions { gap:3px; }.user-name,.top-divider,.topbar-actions .icon-button:first-child { display:none; }.page-content { padding:30px 17px 50px; }.welcome-row,.page-heading { align-items:flex-start; flex-direction:column; gap:17px; margin-bottom:23px; }.welcome-row h1,.page-heading h1 { font-size:26px; }.page-heading>.primary-button,.welcome-row>.primary-button { width:100%; }.stat-grid { grid-template-columns:repeat(2,1fr); gap:10px; }.stat-card { padding:15px; }.stat-card strong { font-size:24px; }.quick-row,.appearance-layout,.settings-layout { grid-template-columns:1fr; }.quick-card { padding:14px; }.panel { padding:18px; }.toolbar { flex-wrap:wrap; padding:13px; }.search-box { min-width:100%; max-width:none; }.toolbar select { flex:1; }.result-count { margin-left:0; }.table-wrap { display:none; }.mobile-post-list { display:grid; }.mobile-post-card { padding:15px 13px; border-top:1px solid #f1e9e8; }.mobile-post-card:first-child { border-top:0; }.mobile-post-meta { display:flex; align-items:center; gap:10px; margin:12px 0 0 54px; color:#aaa0a4; font-size:10px; }.mobile-post-meta .row-actions { margin-left:auto; }.media-tabs small { display:none; }.media-grid { grid-template-columns:repeat(2,1fr); gap:10px; }.media-preview { height:122px; }.select-cards { gap:6px; }.wallpaper-choice { height:59px; }.site-preview { height:300px; }.preview-nav span { display:none; }.preview-nav i { display:block; font-style:normal; }.preview-center strong { font-size:25px; }.editor-body { grid-template-columns:1fr; gap:4px; padding:20px; }.editor-side { padding:10px 0 0; border-top:1px solid #f0e7e6; border-left:0; }.editor-head { padding:21px 20px 17px; }.editor-foot { padding:14px 20px; }.editor-foot>* { flex:1; }.two-fields { grid-template-columns:1fr; gap:0; }.toast { right:15px; bottom:15px; left:15px; justify-content:center; } }
	@media (max-width: 420px) { .stat-grid { grid-template-columns:1fr 1fr; }.stat-card small { font-size:9px; }.panel-heading { gap:7px; }.panel-heading h2 { font-size:16px; }.media-info { padding:9px; }.media-info b { font-size:10px; } }
</style>
