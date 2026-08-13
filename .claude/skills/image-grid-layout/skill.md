---
name: image-grid-layout
description: Use when publishing blog posts with images, especially for image gallery posts or when user requests image grid layout
---

# Image Grid Layout

## Overview

This skill provides guidance for creating blog posts with image grid layouts in the Firefly blog theme. It uses the `[grid]` and `[/grid]` tags to display multiple images in a responsive grid layout.

## When to Use

- User requests to publish an image gallery post
- User wants to add multiple images in a grid layout
- User explicitly mentions "图片画廊", "图片网格", "image grid", or "gallery"
- User asks to include images in a blog post and wants grid layout

## Core Pattern

### Basic Image Grid Syntax

```markdown
[grid]
![图片描述一](./images/image1.avif)
![图片描述二](./images/image2.avif)
![图片描述三](./images/image3.avif)
[/grid]
```

### Image Grid with Captions

```markdown
[grid]
![示例图片一](./images/firefly1.avif)
![示例图片二](./images/firefly2.avif)
![示例图片三](./images/firefly3.avif)
[/grid]
```

## Features

- **Responsive Grid**: Automatically arranges images in a responsive grid (up to 4 images per row)
- **Auto Height Alignment**: Images with different heights are automatically aligned using object-cover
- **Caption Alignment**: Image captions are aligned at the bottom regardless of image height
- **Lightbox Support**: Clicking images opens them in a lightbox for full view

## Workflow

### For Image Gallery Posts

When user requests to publish an image gallery post:

1. Create a new markdown file in `src/content/posts/`
2. Include proper frontmatter (title, published, tags, category, etc.)
3. Place images in `./images/` subdirectory relative to the post
4. Use `[grid]` and `[/grid]` tags to wrap images
5. Add image descriptions in markdown image syntax

### For Posts with Embedded Images

When user wants to add images to an existing or new post:

1. **Ask the user**:
   - Do you want to use image grid layout? (yes/no)
   - Where should the images be placed? (beginning/middle/end/specific section)

2. If user chooses grid layout:
   - Wrap images with `[grid]` and `[/grid]` tags
   - Ensure images are in the correct directory

3. If user chooses regular layout:
   - Use standard markdown image syntax without grid tags

## Example Post Template

```markdown
---
title: 图片画廊示例
published: 2026-08-13
pinned: false
description: 这是一个图片画廊示例文章
tags: [图片, 画廊, 示例]
category: 图片
---

## 图片画廊展示

[grid]
![图片一](./images/photo1.avif)
![图片二](./images/photo2.avif)
![图片三](./images/photo3.avif)
[/grid`

## 图片说明

这里可以添加图片的详细说明文字。
```

## Common Mistakes

### ❌ Forgetting Grid Tags
```markdown
![图片一](./images/photo1.avif)
![图片二](./images/photo2.avif)
```
This will display images vertically, not in a grid.

### ❌ Wrong Image Path
```markdown
[grid]
![图片](/images/photo1.avif)  // Wrong: using absolute path
[/grid]
```
Use relative paths starting with `./`

### ✅ Correct Path
```markdown
[grid]
![图片](./images/photo1.avif)  // Correct: relative path
[/grid]
```

## Image Directory Structure

```
src/content/posts/
  your-post/
    images/
      photo1.avif
      photo2.avif
    index.md
```

Or for single post files:

```
src/content/posts/
  your-post.md
  images/
    photo1.avif
    photo2.avif
```

## Quick Reference

| Task | Syntax |
|------|--------|
| Start grid | `[grid]` |
| End grid | `[/grid]` |
| Add image | `![description](./path/to/image.avif)` |
| Max images per row | 4 (automatic) |
| Supported formats | avif, webp, png, jpg |
