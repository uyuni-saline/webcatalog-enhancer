# AGENTS.md

## Project overview

This repository contains a lightweight Tampermonkey userscript for Comike Web Catalog. The implementation is intentionally kept in one directly installable file without a build step.

## Repository layout

- `webcatalog-enhancer.user.js`: main userscript and release artifact.
- `README.md`: user-facing feature, installation, and update information only.
- `AGENTS.md`: development and maintenance guidance for coding agents.

## Maintenance rules

- Keep all runtime code in `webcatalog-enhancer.user.js` unless a build process is deliberately introduced.
- Preserve the `@updateURL` and `@downloadURL` values so installed scripts continue receiving updates from `main`.
- Increase the metadata `@version` whenever publishing a functional change.
- Keep page-specific behavior separated by URL path: favorites, circle details, and print pages.
- Reuse `fetchCircleDetails()` for data extracted from circle detail pages and keep its request cache intact.
- On the favorites page, an X/Twitter URL extracted from the favorite memo has priority over the detail-page URL. Keep the unmodified detail result separately so removing the memo URL can fall back to it again.
- Keep the favorites-page copy buttons synchronized with detail data: `摊位` copies placement only, `社团` copies the cleaned circle name, and `作者` copies the cleaned author name.
- Reuse `safeFilenameBase()` and `buildCircleAuthor()` whenever constructing `[circle (author)]` text. Never apply filename cleaning to the date, region, hall, booth letter, booth number, or a/b side marker.
- Keep the filename-cleaning behavior aligned with the reference Python logic: normalize full-width Latin letters, replace Windows-invalid characters with full-width equivalents, remove controls, collapse whitespace, trim trailing dots/spaces, handle reserved names, and enforce the 180-character limit.
- Keep `PRINT_DETAIL_LINK_KEYS`, print-page icon order, and CSV link-column order synchronized: Pixiv, X, website, Melonbooks, BOOTH.
- Print-page CSV rows are updated asynchronously. Export must wait for all collected detail requests before generating the file.
- Preserve original full-width booth letters and a/b side markers when changing hall mappings.
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
