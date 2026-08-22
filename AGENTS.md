# AGENTS.md

## Project overview

This repository contains a lightweight Tampermonkey userscript for Comike and COMITIA Web Catalog. The implementation is intentionally kept in one directly installable file without a build step.

## Repository layout

- `webcatalog-enhancer.user.js`: main userscript and release artifact.
- `README.md`: user-facing feature, installation, and update information only.
- `AGENTS.md`: development and maintenance guidance for coding agents.

## Maintenance rules

- Keep all runtime code in `webcatalog-enhancer.user.js` unless a build process is deliberately introduced.
- Preserve the `@updateURL` and `@downloadURL` values so installed scripts continue receiving updates from `main`.
- Increase the metadata `@version` whenever publishing a functional change.
- Keep page-specific behavior separated by hostname and URL path: Comike favorites, circle details, print pages, and the COMITIA list page.
- Reuse `fetchCircleDetails()` for data extracted from circle detail pages and keep its request cache intact.
- On the favorites page, an X/Twitter URL extracted from the favorite memo has priority over the detail-page URL. Keep the unmodified detail result separately so removing the memo URL can fall back to it again.
- Keep the favorites-page copy buttons synchronized with detail data: `摊位` copies placement only, `社团` copies the cleaned circle name, and `作者` copies the cleaned author name.
- Reuse `safeFilenameBase()` and `buildCircleAuthor()` whenever constructing `[circle (author)]` text. Never apply filename cleaning to the date, region, hall, booth letter, booth number, or a/b side marker.
- Keep the filename-cleaning behavior aligned with the reference Python logic: normalize full-width Latin letters, replace Windows-invalid characters with full-width equivalents, remove controls, collapse whitespace, trim trailing dots/spaces, handle reserved names, and enforce the 180-character limit.
- Keep `PRINT_DETAIL_LINK_KEYS`, print-page icon order, and CSV link-column order synchronized: Pixiv, X, website, Melonbooks, BOOTH.
- Print-page CSV rows are updated asynchronously. Export must wait for all collected detail requests before generating the file.
- Preserve original full-width booth letters and a/b side markers when changing hall mappings.
- On the COMITIA list page, read the author from each row's `.circle-chk-pn`, keep the placement text unchanged, and reuse `buildCircleAuthor()` for the copied `placement [circle (author)]` value.
- Keep COMITIA list enhancements idempotent because the site can redraw rows dynamically.
- Hide COMITIA ad regions through their structural containers (`.sub-container-1`, `.sub-container-3`, and `.modal-ad`) and let the list region use the released space.
- Treat `#list_table_div.cut-list-mode` as the Web/application-cut detail layout and the absence of that class as the no-cut list layout. Observe class changes so switching modes is handled immediately.
- In the no-cut COMITIA layout, keep circle and author in separate compact columns, hide the unused cut-view `情報` header, and render placement plus `📋` as one button.
- In COMITIA cut detail layouts, preserve the site's table layout and append only a `📋` copy button to the end of each `リンク` button group.
- Keep all COMITIA copy buttons white with black text, while keeping their copied value in `placement [circle (author)]` format.
- Keep the COMITIA color column at the site's original `2rem` width in the no-cut layout and do not responsively hide its list columns.
- Size the COMITIA main container to about 75% of the viewport in landscape orientation and 100% in portrait orientation.
- Keep README content user-oriented; place implementation and release instructions here instead.
- Publish approved lightweight changes directly to the `main` branch.

## Verification

- Run `node --check webcatalog-enhancer.user.js` after every script change.
- Test print-page link rendering with both complete and missing detail links.
- Test filename cleaning independently and verify that placement text is unchanged.
- Test detail-page X fallback with an off icon and a link contained only in the favorite memo.
- Test favorites-page X priority in both directions: memo overrides detail, and removing the memo URL restores the detail URL.
- Test all three favorites-page copy buttons, including disabled placeholders before detail data arrives and idempotent re-rendering.
- Verify that CSV output has the same number and order of fields as its header.
- Confirm that repeated asynchronous rendering does not duplicate icon buttons.
- Test the COMITIA example `う37a / 白いふわふわ / 花睡ささみ` in all three display modes, including separate list columns, both button placements, copied text, mode switching, and repeated rendering.
- Verify that COMITIA ad containers are hidden, the no-cut `情報` header stays hidden, the color column remains `2rem`, and cut detail layouts retain their original columns.
