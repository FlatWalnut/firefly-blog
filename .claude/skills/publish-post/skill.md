---
name: publish-post
description: Use when publishing new blog posts, managing content, or performing common blog operations in the Firefly project
---

# Firefly Blog Publishing Skill

## Overview

This skill provides a complete guide for publishing blog posts and managing the Firefly blog theme project. It covers the entire workflow from creating posts to pushing to GitHub.

## Publishing Workflow (Interactive)

When user requests to publish a new post, **ask the following questions first**:

### Required Information
1. **文章标题** - What is the post title?
2. **文章内容** - What is the content or topic?
3. **图片** - Do you have images to include? If yes, provide paths

### Optional Features (Ask about each)
4. **预览图 (Cover Image)**
   - 使用文章第一张图作为预览图？(yes/no)
   - 或指定特定图片路径？
   - Note: Preview image shows in post list on homepage

5. **标签 (Tags)**
   - What tags to add? (comma separated)

6. **分类 (Category)**
   - Which category? (e.g., 文章示例, 博客指南, 图片, 教程)

7. **置顶 (Pinned)**
   - Pin this post to top? (yes/no)

8. **加密 (Password Protection)**
   - Enable password protection? (yes/no)
   - If yes, what password?

9. **评论 (Comments)**
   - Enable comments? (yes/no)
   - Note: Requires comment system configured in `src/config/commentConfig.ts`

10. **草稿 (Draft)**
    - Save as draft? (yes/no)

## Post Frontmatter Template

```yaml
---
title: 文章标题              # Required
published: 2026-08-13       # Required: publish date
pinned: false               # Pin to top of list
draft: false                # Draft mode (not published)
description: 文章描述        # For SEO and post list
tags: [标签1, 标签2]         # Tags array
category: 分类              # Category string
image: ./images/first.jpg   # Cover image (use first image if not specified)
password: ""                # Password protect post (empty = no password)
passwordHint: ""            # Password hint (optional)
comment: true               # Enable comments
lang: zh_CN                 # Post language
slug: post-url-slug         # Optional: custom URL slug
---
```

## Cover Image (Preview Image)

The cover image appears in the post list on the homepage.

### Option 1: Auto-use First Image
If post has images, the first image is automatically used as cover.

### Option 2: Specify Explicitly
```yaml
image: ./images/cover.avif
```

### Option 3: No Cover Image
```yaml
image: ""  # or omit the field
```

## Password Protection (加密)

When enabled, readers must enter password to view content.

### Setup
```yaml
---
password: "123456"          # Your password
passwordHint: "密码是123456" # Optional hint
---
```

### How It Works
- Content is encrypted at build time (AES-256-GCM)
- Reader enters password in browser
- Decrypted client-side using Web Crypto API
- Password cached in session (no re-entry on refresh)

## Comment System (评论)

Enable comments on specific posts.

### Global Config
Edit `src/config/commentConfig.ts`:
```typescript
type: "twikoo",  // or "waline", "giscus", "disqus", "artalk"
```

### Per-Post Control
```yaml
comment: true    # Enable comments (default)
comment: false   # Disable comments
```

## Project Structure Quick Reference

```
src/
├── content/posts/          # Blog posts (markdown files)
├── config/                 # All configuration files
│   ├── siteConfig.ts       # Site title, subtitle, description
│   ├── profileConfig.ts    # Avatar, name, bio
│   ├── commentConfig.ts    # Comment system settings
│   ├── backgroundWallpaper.ts  # Banner text, wallpaper settings
│   ├── navBarConfig.ts     # Navigation links
│   └── sidebarConfig.ts    # Sidebar layout
├── components/             # UI components
└── assets/images/          # Static images
```

## Publishing a New Post

### Step 1: Gather Information from User
Ask all questions from "Publishing Workflow" section above.

### Step 2: Create Post Directory
```bash
mkdir -p src/content/posts/<post-slug>/images
```

### Step 3: Copy Images (if provided)
```bash
cp /path/to/images/* src/content/posts/<post-slug>/images/
```

### Step 4: Create Post File
Create `index.md` with frontmatter and content.

### Step 5: Preview
```bash
pnpm dev
```
Visit `http://localhost:4321` to preview.

### Step 6: Commit and Push
```bash
git add src/content/posts/<post-slug>/
git commit -m "feat: 发布《文章标题》文章"
git push origin main
```

## Quick Commands Reference

| Task | Command |
|------|---------|
| Start dev server | `pnpm dev` |
| Build for production | `pnpm build` |
| Type check | `pnpm check` |
| Lint code | `pnpm lint` |
| Create new post | `pnpm new-post <filename>` |
| Create new dynamic | `pnpm new-dynamic` |

## Git Commit Convention

- `feat:` - New feature/post
- `fix:` - Bug fix
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes

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

## Example: Complete Post Creation

```bash
# 1. Create post directory
mkdir -p src/content/posts/my-new-post/images

# 2. Copy images
cp /path/to/image1.png src/content/posts/my-new-post/images/
cp /path/to/image2.png src/content/posts/my-new-post/images/

# 3. Create post file with all features
cat > src/content/posts/my-new-post/index.md << 'EOF'
---
title: 我的新文章
published: 2026-08-13
pinned: false
draft: false
description: 这是一篇新文章
tags: [示例, 教程]
category: 教程
image: ./images/image1.png
password: ""
comment: true
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
