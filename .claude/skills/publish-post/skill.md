---
name: publish-post
description: Use when publishing new blog posts, managing content, or performing common blog operations in the Firefly project
---

# Firefly Blog Publishing Skill

## Overview

This skill provides a complete guide for publishing blog posts and managing the Firefly blog theme project. It covers the entire workflow from creating posts to pushing to GitHub.

## Project Structure Quick Reference

```
src/
├── content/posts/          # Blog posts (markdown files)
├── config/                 # All configuration files
│   ├── siteConfig.ts       # Site title, subtitle, description
│   ├── profileConfig.ts    # Avatar, name, bio
│   ├── backgroundWallpaper.ts  # Banner text, wallpaper settings
│   ├── navBarConfig.ts     # Navigation links
│   └── sidebarConfig.ts    # Sidebar layout
├── components/             # UI components
└── assets/images/          # Static images
```

## Publishing a New Post

### Step 1: Create Post Directory

```bash
mkdir -p src/content/posts/<post-slug>
```

### Step 2: Create Post File

Create `index.md` in the post directory with frontmatter:

```markdown
---
title: 文章标题
published: YYYY-MM-DD
pinned: false
description: 文章描述
tags: [标签1, 标签2]
category: 分类
image: ./cover.avif  # Optional: cover image
---

文章内容...
```

### Step 3: Add Images (If Needed)

1. Create `images/` subdirectory in post folder
2. Copy images to the directory
3. Reference in markdown:

```markdown
# Single image
![描述](./images/photo.avif)

# Image grid (use skill: image-grid-layout)
[grid]
![图片一](./images/photo1.avif)
![图片二](./images/photo2.avif)
[/grid]
```

### Step 4: Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:4321` to preview.

## Common Operations

### Update Site Configuration

**Site title/subtitle**: Edit `src/config/siteConfig.ts`
```typescript
title: "站点标题",
subtitle: "副标题",
```

**Profile (name/bio)**: Edit `src/config/profileConfig.ts`
```typescript
name: "你的名字",
bio: "个人简介",
```

**Banner text**: Edit `src/config/backgroundWallpaper.ts`
```typescript
title: "主标题",
subtitle: ["副标题1", "副标题2"],
```

### Update Post Dates

```bash
# Update all posts to today's date
find src/content/posts -name "*.md" -exec sed -i 's/published: YYYY-MM-DD/published: $(date +%Y-%m-%d)/g' {} \;
```

## Git Operations

### Commit and Push

```bash
# Add specific files
git add src/content/posts/<post-slug>/

# Commit with message
git commit -m "feat: 发布《文章标题》文章"

# Push to GitHub
git push origin main
```

### Commit Message Convention

- `feat:` - New feature/post
- `fix:` - Bug fix
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes

## Quick Commands Reference

| Task | Command |
|------|---------|
| Start dev server | `pnpm dev` |
| Build for production | `pnpm build` |
| Type check | `pnpm check` |
| Lint code | `pnpm lint` |
| Create new post | `pnpm new-post <filename>` |
| Create new dynamic | `pnpm new-dynamic` |

## Post Frontmatter Reference

```yaml
---
title: 文章标题              # Required
published: 2026-08-13       # Required: publish date
updated: 2026-08-13         # Optional: last update date
pinned: false               # Pin to top of list
draft: false                # Draft mode (not published)
description: 文章描述        # For SEO and post list
tags: [标签1, 标签2]         # Tags array
category: 分类              # Category string
image: ./cover.avif         # Cover image path
password: ""                # Password protect post
comment: true               # Enable comments
lang: zh_CN                 # Post language
---
```

## Image Guidelines

### Supported Formats
- AVIF (recommended, smallest size)
- WebP (good balance)
- PNG/JPG (larger files)

### Image Paths
- **Relative to post**: `./images/photo.avif`
- **From public dir**: `/assets/images/photo.avif`
- **Remote URL**: `https://example.com/photo.avif`

### Best Practices
1. Use AVIF format for best compression
2. Keep images under 500KB for fast loading
3. Use descriptive filenames
4. Store images in post's `images/` subdirectory

## Troubleshooting

### Post Not Showing
1. Check `published` date is not in the future
2. Ensure `draft: false`
3. Restart dev server

### Images Not Loading
1. Verify image path is correct
2. Check image file exists in specified location
3. Use relative paths starting with `./`

### Build Errors
1. Run `pnpm check` to find type errors
2. Run `pnpm lint` to fix code style issues
3. Check console for specific error messages

## Example: Complete Post Creation

```bash
# 1. Create post directory
mkdir -p src/content/posts/my-new-post/images

# 2. Copy images
cp /path/to/image1.png src/content/posts/my-new-post/images/
cp /path/to/image2.png src/content/posts/my-new-post/images/

# 3. Create post file
cat > src/content/posts/my-new-post/index.md << 'EOF'
---
title: 我的新文章
published: 2026-08-13
description: 这是一篇新文章
tags: [示例, 教程]
category: 教程
---

## 文章内容

[grid]
![图片一](./images/image1.png)
![图片二](./images/image2.png)
[/grid]
EOF

# 4. Start dev server to preview
pnpm dev

# 5. Commit and push
git add src/content/posts/my-new-post/
git commit -m "feat: 发布《我的新文章》"
git push origin main
```
