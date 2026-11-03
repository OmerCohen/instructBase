# archive/ — frozen copies of the training material

| Path | What |
|---|---|
| `index.html` | Landing page: list of snapshots with view and download links. Linked from the root `index.html` footer. |
| `2026-11-03/` | The whole published set as it was on 2026-11-03, before the HTML editor: `index.html`, `radio/`, `networks/`, `devices/`, `reference/`, plus `guide-sources/` (the 16 guide-PDF sources, copied from `.agents/guide-sources/`). Opens on its own: all links are relative. |
| `instructbase-2026-11-03.zip` | The same 51 files in one ZIP, under a top folder `instructbase-2026-11-03/`. |
| `instructbase-2026-08-06.zip` | The earlier ZIP that sat at the repo root as `חומרי הדרכה.zip` (13 lessons, radio and networks only). Moved here and renamed to ASCII per the path rule in `agents.md`. Contents unchanged. |

Rules:
- **Do not edit anything under `archive/`.** It exists so the live set can change. The editor skips this folder.
- New snapshot: copy the published set to `archive/YYYY-MM-DD/`, zip it, add a row to `archive/index.html`.
- Not in the snapshot on purpose: `.agents/` notes and unit sheets (internal), `tmp/`, `techGame/` (the index links to its external deployment). Git history keeps all of them.
- The archive contains no internal notes, so it can be published with the rest of the set.
