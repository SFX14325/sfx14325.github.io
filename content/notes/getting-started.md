---
title: Getting Started
tags:
  - ideas
  - learning
---

# Getting started

This is your personal knowledge garden. Capture thoughts, questions, observations, plans, and things you learn. Each Markdown file becomes a note in the graph.

## Connect thoughts

Write `[[birds/birdwatching]]` or `[[birds/northern-cardinal]]` to link notes. Linked notes become connected dots in the graph. A note can have several tags, but its first tag determines its primary graph cluster.

> [!NOTE] Static publishing
> GitHub Pages hosts the files but cannot write edits back into the repository. Edit Markdown locally or in GitHub, then commit and push.

## Add a note

Create a `.md` file anywhere under `content/`. Add YAML frontmatter:

```yaml
---
title: My note title
tags:
  - ideas
  - personal
---
```

Then run `npm run build-index` and commit the updated `content/index.json`.
