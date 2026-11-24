# My Knowledge Garden

A static Markdown knowledge graph for GitHub Pages.

## Interface
- Left: folder navigation and color-coded tag filters.
- Center: interactive graph of Markdown notes, clustered by each note's first tag.
- Right: Markdown reader. Wiki links open another note in the same panel.
- Drag the graph to pan. Scroll to zoom around the pointer. Use +, −, and Fit controls.
- Click a node to open its note.

## Add content
Create a Markdown file under `content/` and add YAML frontmatter:

```yaml
---
title: A note title
tags:
  - ideas
  - personal
---
```

Define each tag's display name and color in `content/tags.json`. Use `[[note]]`, `[[folder/note]]`, or `[[note|display label]]` to link notes.

After adding, renaming, or deleting Markdown files, run `npm run build-index`. Commit the Markdown files, `content/tags.json`, and generated `content/index.json`.

## Publish
Push this project to GitHub. In **Settings → Pages**, choose **Deploy from a branch**, then select your branch and `/ (root)`.

The site is static. Markdown files are edited in a local editor or GitHub and published by pushing commits. It does not save browser edits back to the repository.

## Included bird test vault
The `content/birds/` folder contains example notes about birdwatching, Northern Cardinals, Blue Jays, Black-capped Chickadees, Bald Eagles, migration, backyard habitat, and field observations.

## Automatic index rebuilding and deployment

This repository includes `.github/workflows/deploy.yml`. After you set GitHub Pages to use **GitHub Actions** as its deployment source, every push to the `main` branch will:

1. Check out the repository.
2. Run `npm run build`, which scans every folder under `content/` for `.md` files and regenerates `content/index.json`.
3. Package the site and deploy it to GitHub Pages.

You no longer need to run `npm run build-index` manually before publishing. You can still run it locally when you want to preview the updated index before pushing.

The workflow currently watches the `main` branch. If your repository uses a different default branch, change the branch name in `.github/workflows/deploy.yml`.


## Graph display updates (v5)
- Tag-cluster headings in the graph are bold for easier scanning.
- Every graph node displays its note title beneath the dot.
- Panning uses eased movement so dragging feels smoother.


## Deployment workflow v6

The Pages workflow uses separate build and deploy jobs. The build job regenerates `content/index.json` and uploads the Pages artifact. The deploy job waits for the build job and has `actions: read`, `pages: write`, and `id-token: write` permissions. The artifact upload includes hidden files such as `.nojekyll`.
