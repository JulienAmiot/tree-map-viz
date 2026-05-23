# Third-party licenses

Tree Map Viz bundles open-source code authored by third parties. Their
licenses are reproduced in full below, per the SPEC §17.131 dependency
audit. The About modal links here under the "Open-source notices" row
so an operator running the kiosk has the attribution available at
runtime.

The kiosk's own source code is governed by the repository's top-level
license (see `package.json` + the repo's GitHub front page).

---

## Lucide (`lucide-static`)

Source: <https://lucide.dev> · Catalogue: <https://lucide.dev/icons>

The `<ds-icon>` atom (`src/adapters/ui/atoms/icon/Icon.ts`) embeds a
subset of Lucide's icon SVGs at build time via Vite's `?raw` import
mechanism. The icons listed in the `ICON_REGISTRY` constant in that
file are the only Lucide assets that ship in the production bundle;
the rest of `lucide-static` is tree-shaken out.

Lucide is dual-licensed: the bulk of the catalogue (including every
Lucide-original icon) is **ISC**; a subset that pre-dates the Lucide
fork remains under the original Feather **MIT** license. Both texts
are reproduced verbatim below, copied from
`node_modules/lucide-static/LICENSE`.

### ISC License (Lucide-original icons)

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### MIT License (icons derived from Feather)

Per the upstream `LICENSE` file, the following icons remain under the
Feather MIT license:

> airplay, alert-circle, alert-octagon, alert-triangle, aperture,
> arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down,
> arrow-left-circle, arrow-left, arrow-right-circle, arrow-right,
> arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign,
> calendar, cast, check, chevron-down, chevron-left, chevron-right,
> chevron-up, chevrons-down, chevrons-left, chevrons-right,
> chevrons-up, circle, clipboard, clock, code, columns, command,
> compass, corner-down-left, corner-down-right, corner-left-down,
> corner-left-up, corner-right-down, corner-right-up, corner-up-left,
> corner-up-right, crosshair, database, divide-circle, divide-square,
> dollar-sign, download, external-link, feather, frown, hash,
> headphones, help-circle, info, italic, key, layout, life-buoy,
> link-2, link, loader, lock, log-in, log-out, maximize, meh,
> minimize, minimize-2, minus-circle, minus-square, minus, monitor,
> moon, more-horizontal, more-vertical, move, music, navigation-2,
> navigation, octagon, pause-circle, percent, plus-circle, plus-square,
> plus, power, radio, rss, search, server, share, shopping-bag,
> sidebar, smartphone, smile, square, table-2, tablet, target,
> terminal, trash-2, trash, triangle, tv, type, upload, x-circle,
> x-octagon, x-square, x, zoom-in, zoom-out

```
The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
