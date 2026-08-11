# AGENTS.md

## Project overview

This repository contains a lightweight Tampermonkey userscript for Comike Web Catalog. The implementation is intentionally kept in one directly installable file without a build step.

## Repository layout

- `webcatalog-enhancer.user.js`: main userscript and release artifact.
- `README.md`: user-facing feature, installation, update, and license information only.
- `AGENTS.md`: development and maintenance guidance for coding agents.

## Maintenance rules

- Keep all runtime code in `webcatalog-enhancer.user.js` unless a build process is deliberately introduced.
- Preserve the `@updateURL` and `@downloadURL` values so installed scripts continue receiving updates from `main`.
- Increase the metadata `@version` whenever publishing a functional change.
- Keep page-specific behavior separated by URL path: favorites, circle details, and print pages.
- Reuse `fetchCircleDetails()` for data extracted from circle detail pages and keep its request cache intact.
- Keep `PRINT_DETAIL_LINK_KEYS`, print-page icon order, and CSV link-column order synchronized: Pixiv, X, website, Melonbooks, BOOTH.
- Print-page CSV rows are updated asynchronously. Export must wait for all collected detail requests before generating the file.
- Preserve original full-width booth letters and a/b side markers when changing hall mappings.
- Keep README content user-oriented; place implementation and release instructions here instead.
- Publish approved lightweight changes directly to the `main` branch.

## Verification

- Run `node --check webcatalog-enhancer.user.js` after every script change.
- Test print-page link rendering with both complete and missing detail links.
- Verify that CSV output has the same number and order of fields as its header.
- Confirm that repeated asynchronous rendering does not duplicate icon buttons.
