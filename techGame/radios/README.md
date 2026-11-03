# Radio device photos

Drop a real device photo here and it shows up automatically in the radio-set
diagnostics panel as a hero image above the interactive controls.

## Convention

- File name = the model id, PNG: `<id>.png`
- Model ids: `prc710`, `mk91`, `mk93`, `vrc120`, `vrc121`, `vrc122`
- e.g. `public/radios/prc710.png`

To use a different name or format (jpg/webp), set `image` on the model in
`src/game/radio/radioSet.ts`, e.g. `image: '/radios/prc710.jpg'`.

## Populated

- `prc710.jpg` — מק"710 front panel (resized to ~99 KB)
- `vrc120.jpg` — מק"120 front panel (Hebrew labels)
- `vrc122.jpg` — מק"122 vehicular set
- These are wired via the `image` field in `radioSet.ts`. `mk91`, `mk93`,
  `vrc121` still fall back to the drawn illustration until photos are added.

> Note: the `vrc120.jpg` reference carries a Dreamstime stock-photo copyright in
> its EXIF — replace it with a rights-cleared/own photo before any public use.

## Recommended

- Front-panel view of the set, controls/connectors visible.
- Landscape, ~800–1200px wide, file < ~300 KB (png/webp).
- A dark or transparent background blends best with the panel.
- Use only images you have the rights to (issue/training material, your own
  photos, or a clearly-licensed source).

If no file is present, the panel falls back to the drawn illustration — nothing
breaks. Once a file is dropped in, it appears on the next load.

> Note: tapping the labeled controls (connectors / knobs) below the photo is how
> you operate the set. If you want the connectors to be tappable *directly on the
> photo*, send the image and I'll add per-model hotspot coordinates.
