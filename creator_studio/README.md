# Knowledge Garden Creator Studio 1.0 development preview

Windows: install Python 3.11+ from python.org (include Python launcher), extract this ZIP outside the public repository, run start_windows.bat. A local browser window opens. Keep the terminal running; Ctrl+C stops the program. First launch needs internet for Python packages. Select your existing v9 repository or its content directory by entering the full path. Back up the repository before testing.

This is a loopback-only local application, not a Tauri executable. It writes ordinary Markdown and the existing tags.json schema. No website changes required. Use Markdown mode for complex notes; page mode previews and split mode previews while typing. Experimental visual editing is limited to simple notes; conversion is not lossless. Private revisions, recovery drafts, archives and templates live under ~/.knowledge_garden_studio, outside the repository. Archive moves the note only, not its attachments. Recovery drafts are snapshots, not a full private publishing workflow. Existing dates are unknown until supplied or first saved. The italic footer is generated on save. Do not commit private notes or attachments to a public repository.

Implemented: workspace selection, note and folder creation, source editor, preview, split view, basic visual editing, tag creation/recolor/assignment, internal/external links, media import, embed insertion, metadata, revision snapshots, archive, draft recovery, template editing, search, basic statistics and wiki validation. Not implemented: safe rename/move/reference repair, tag deletion/rename, archive restoration UI, full attachment validation, native file picker, full fidelity visual editing, publishing, exact website theme, complete analytics. Browser and Windows testing still required.

## v1.2
New note dialog defaults to selected folder; filename and displayed title are separate. Tags and text color use a native color picker with HEX input. Attachments appear in the tree and open in a preview dialog. Delete note keeps a timestamped copy under the workspace's private `deleted` directory; restore manually by copying it back. Incoming wiki links are checked heuristically; attachments are retained.

For public colored text, copy `optional_website_patch/scripts/compile-content.py` over the matching v9 website script. No other website changes are needed. Without this patch the text remains readable but its color is stripped. Apply color in Markdown or Split mode; experimental visual conversion is not supported for colored notes.

## v1.3
Existing media references use relative paths without copying files. Assign tags uses checkboxes. Input and confirmation dialogs are styled in-app. CSS dependency included.

## v1.4
Searchable alphabetical tag selector; selection persists during filtering. Existing tag order is retained for graph grouping. Shared inline tag serialization. Unsaved navigation offers save, discard or cancel.
