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
