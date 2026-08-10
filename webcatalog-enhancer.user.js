// ==UserScript==
// @name         Comike Web Catalog Enhancer
// @namespace    https://github.com/uyuni-saline/webcatalog-enhancer
// @version      2.3.0
// @description  增强Comike Web Catalog的社交链接、社团信息复制及CSV导出功能
// @author       Saline
// @homepageURL  https://github.com/uyuni-saline/webcatalog-enhancer
// @supportURL   https://github.com/uyuni-saline/webcatalog-enhancer/issues
// @updateURL    https://raw.githubusercontent.com/uyuni-saline/webcatalog-enhancer/main/webcatalog-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/uyuni-saline/webcatalog-enhancer/main/webcatalog-enhancer.user.js
// @match        https://classic-webcatalog.circle.ms/User/Favorites*
// @match        https://classic-webcatalog.circle.ms/Circle/*
// @match        https://classic-webcatalog-free.circle.ms/Circle/*
// @match        https://classic-webcatalog.circle.ms/Print*
// @exclude      https://classic-webcatalog.circle.ms/Circle/List*
// @exclude      https://classic-webcatalog-free.circle.ms/Circle/List*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SELECTORS = {
        favoriteCell: 'td.infotable-left[colspan="3"]',
        memoEditButton: 'a.c-btn.c-btn--blue',
        favoriteMemo: 'span[data-bind*="favMemo"]',
        item: 'div.item'
    };

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise((resolve, reject) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                if (!document.execCommand('copy')) {
                    throw new Error('document.execCommand("copy") returned false');
                }
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                textarea.remove();
            }
        });
    }

    function createCopyPanel(text) {
        const panel = document.createElement('div');
        panel.className = 'wc-enhancer-copy-panel';
        panel.style.backgroundColor = 'white';
        panel.style.padding = '10px';
        panel.style.border = '1px solid black';
        panel.style.margin = '10px 0';
        panel.style.cursor = 'pointer';
        panel.title = '点击复制';
        panel.textContent = text;

        panel.addEventListener('click', () => {
            copyToClipboard(text)
                .then(() => {
                    panel.textContent = `${text} 已复制`;
                    window.setTimeout(() => {
                        panel.textContent = text;
                    }, 1500);
                })
                .catch(error => {
                    console.error('无法复制内容：', error);
                });
        });

        return panel;
    }

    function normalizeXUrl(url) {
        try {
            const parsed = new URL(url, location.href);
            if (parsed.hostname === 'twitter.com' || parsed.hostname === 'www.twitter.com') {
                parsed.hostname = 'x.com';
            }
            return parsed.hostname === 'x.com' || parsed.hostname === 'www.x.com'
                ? parsed.href
                : '';
        } catch (_error) {
            return '';
        }
    }

    function extractXUrlFromText(text) {
        const match = text.match(/https:\/\/(?:www\.)?(?:x|twitter)\.com\/[^\s]+/i);
        return match ? normalizeXUrl(match[0]) : '';
    }

    function normalizePixivUrl(url) {
        try {
            const parsed = new URL(url, location.href);
            return parsed.protocol === 'https:' &&
                (parsed.hostname === 'pixiv.net' || parsed.hostname === 'www.pixiv.net')
                ? parsed.href
                : '';
        } catch (_error) {
            return '';
        }
    }

    function normalizeWebsiteUrl(url) {
        if (!url || !String(url).trim()) return '';
        try {
            const parsed = new URL(url, location.href);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                ? parsed.href
                : '';
        } catch (_error) {
            return '';
        }
    }

    function initFavoritesPage() {
        let updateScheduled = false;
        const detailLinkRequests = new Map();

        function findCircleUrl(cell) {
            let row = cell.closest('tr')?.previousElementSibling;

            while (row && !row.matches('tr.webcatalog-circle-list-detail')) {
                row = row.previousElementSibling;
            }

            const circleLink = row?.querySelector(
                'td.infotable-circlename a[href*="/Circle/"]'
            );
            return circleLink?.href || '';
        }

        function fetchDetailLinks(circleUrl) {
            if (detailLinkRequests.has(circleUrl)) {
                return detailLinkRequests.get(circleUrl);
            }

            const request = fetch(circleUrl, { credentials: 'same-origin' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.text();
                })
                .then(html => {
                    const detailDocument = new DOMParser().parseFromString(html, 'text/html');
                    const xIcon = detailDocument.querySelector(
                        'img[alt="X(Twitter)"][src*="img_icon_twitter_on.png"]'
                    );
                    const pixivIcon = detailDocument.querySelector(
                        'img[alt="pixiv"][src*="img_icon_pixiv_on.png"]'
                    );
                    const websiteIcon = detailDocument.querySelector(
                        'img[src*="img_icon_myhome_on.png"]'
                    );

                    return {
                        x: normalizeXUrl(
                            xIcon?.closest('a')?.getAttribute('href') || ''
                        ),
                        pixiv: normalizePixivUrl(
                            pixivIcon?.closest('a')?.getAttribute('href') || ''
                        ),
                        website: normalizeWebsiteUrl(
                            websiteIcon?.closest('a')?.getAttribute('href') || ''
                        )
                    };
                })
                .catch(error => {
                    detailLinkRequests.delete(circleUrl);
                    throw error;
                });

            detailLinkRequests.set(circleUrl, request);
            return request;
        }

        function findFavoriteSupportIcons(cell) {
            const supportRow = cell.closest('tr')?.nextElementSibling;
            return {
                x: supportRow?.querySelector('img.support-list-twitter') || null,
                pixiv: supportRow?.querySelector('img.support-list-pixiv') || null,
                website: supportRow?.querySelector('img.support-list-myhome') || null
            };
        }

        function overrideIconLink(icon, url, activateTwitterIcon = false) {
            if (!icon || !url) return;

            icon.dataset.wcEnhancerUrl = url;
            icon.style.cursor = 'pointer';

            if (activateTwitterIcon) {
                const src = icon.getAttribute('src') || '';
                if (src.includes('img_icon_twitter_off.png')) {
                    icon.setAttribute(
                        'src',
                        src.replace('img_icon_twitter_off.png', 'img_icon_twitter_on.png')
                    );
                }
            }

            if (icon.dataset.wcEnhancerHandlerAttached === 'true') return;
            icon.dataset.wcEnhancerHandlerAttached = 'true';
            icon.addEventListener('click', event => {
                const targetUrl = icon.dataset.wcEnhancerUrl;
                if (!targetUrl) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }, true);
        }

        function applyFavoriteIconLinks(cell, links) {
            const icons = findFavoriteSupportIcons(cell);
            overrideIconLink(icons.x, links.x, true);
            overrideIconLink(icons.pixiv, links.pixiv);
            overrideIconLink(icons.website, links.website);
        }

        async function resolveFavoriteLinks(cell) {
            const memo = cell.querySelector(SELECTORS.favoriteMemo);
            const circleUrl = findCircleUrl(cell);
            let detailLinks = { x: '', pixiv: '', website: '' };

            try {
                if (circleUrl) detailLinks = await fetchDetailLinks(circleUrl);
            } catch (error) {
                console.error(`无法读取社团详情页：${circleUrl}`, error);
            }

            const resolvedLinks = {
                ...detailLinks,
                x: detailLinks.x || extractXUrlFromText(memo?.textContent || '')
            };
            cell._wcEnhancerLinks = resolvedLinks;
            applyFavoriteIconLinks(cell, resolvedLinks);
            cell.dataset.wcEnhancerLinksState = 'done';
        }

        function addFavoriteLinkButtons() {
            document.querySelectorAll(SELECTORS.favoriteCell).forEach(cell => {
                const memoEditButton = cell.querySelector(SELECTORS.memoEditButton);
                const memo = cell.querySelector(SELECTORS.favoriteMemo);
                if (!memoEditButton || !memo) return;

                if (cell.dataset.wcEnhancerLinksState === 'loading') return;
                if (cell.dataset.wcEnhancerLinksState === 'done') {
                    const resolvedLinks = cell._wcEnhancerLinks || {
                        x: '',
                        pixiv: '',
                        website: ''
                    };
                    if (!resolvedLinks.x) {
                        resolvedLinks.x = extractXUrlFromText(memo.textContent);
                    }
                    cell._wcEnhancerLinks = resolvedLinks;
                    applyFavoriteIconLinks(cell, resolvedLinks);
                    return;
                }

                cell.dataset.wcEnhancerLinksState = 'loading';
                resolveFavoriteLinks(cell);
            });
        }

        function scheduleUpdate() {
            if (updateScheduled) return;
            updateScheduled = true;
            window.requestAnimationFrame(() => {
                updateScheduled = false;
                addFavoriteLinkButtons();
            });
        }

        addFavoriteLinkButtons();
        new MutationObserver(scheduleUpdate).observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function findTableValue(label) {
        for (const th of document.querySelectorAll('th')) {
            if (th.textContent.includes(label)) {
                return th.nextElementSibling?.textContent.trim() || '';
            }
        }
        return '';
    }

    function parseSpaceName(spaceName) {
        const parts = spaceName.split('曜日 ');
        if (parts.length < 2) {
            return { day: '', space: spaceName.trim() };
        }
        return {
            day: parts[0].trim(),
            space: parts.slice(1).join('曜日 ').trim()
        };
    }

    function initCirclePage() {
        const target = document.querySelector(SELECTORS.item);
        if (!target || target.querySelector('.js-wc-enhancer-circle-info')) return;

        const title = document.querySelector('meta[property="og:title"]')?.content || '';
        const circleName = title.split(' | ')[0].trim() || '？';
        const spaceName = findTableValue('配置スペース');
        const authorName = findTableValue('執筆者名') || 'NoName';
        const { day, space } = parseSpaceName(spaceName);
        const circleAuthor = `[${circleName} (${authorName})]`;
        const spaceInfo = `${day}${space ? `${space}` : ''} ${circleAuthor}`.trim();

        const container = document.createElement('div');
        container.className = 'js-wc-enhancer-circle-info';
        container.appendChild(createCopyPanel(spaceInfo));

        const twitterIcon = document.querySelector('img[src*="img_icon_twitter_on.png"]');
        const twitterUrl = normalizeXUrl(twitterIcon?.closest('a')?.href || '');
        const twitterInfo = `${twitterUrl || 'NoLink'} ${circleAuthor}`;
        container.appendChild(createCopyPanel(twitterInfo));
        target.appendChild(container);
    }

    function extractPrintRow(cell) {
        const placement = cell.querySelector('span.h-text--bold.h-text--center');
        if (!placement) return null;

        const row = cell.closest('tr');
        const memo = row?.querySelector('td.table-column-memo')?.innerText.trim() || '';
        const colorCell = row?.querySelector('td.c-block--large');
        const colorClass = colorCell?.className.match(/favorite-(color-\d+)/)?.[1] || '';
        const circleAnchor = row?.querySelector('a[href^="/Circle/"]');
        const circleLink = circleAnchor
            ? new URL(circleAnchor.getAttribute('href'), location.origin).href
            : '';

        const contentLines = cell.innerHTML.split(/<br\s*\/?\s*>/i);
        if (contentLines.length < 4) return null;

        const decodeHtml = html => {
            const element = document.createElement('div');
            element.innerHTML = html;
            return element.textContent.trim();
        };

        const dayLocation = placement.innerText.trim();
        const { day, space } = parseSpaceName(dayLocation);
        const dateSpace = `${day}${space}`;
        const circleName = decodeHtml(contentLines[1]) || '？';
        const author = decodeHtml(contentLines[3]) || '？';
        const textLine = `${dateSpace} [${circleName} (${author})]`;

        return {
            values: [textLine, dateSpace, circleName, author, memo, colorClass, circleLink],
            textLine
        };
    }

    function buildCsv(rows) {
        const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
        const header = ['合并', '摊位', '社团', '作者', '备注', '颜色', '社团详情'];
        return [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    }

    function timestamp() {
        const now = new Date();
        const pad = value => String(value).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
            `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    }

    function downloadCsv(rows) {
        const csvContent = `\uFEFF${buildCsv(rows)}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Comike_Info_${timestamp()}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function initPrintPage() {
        if (document.querySelector('.js-wc-enhancer-export')) return;

        const collectedRows = [];
        document.querySelectorAll('td').forEach(cell => {
            const extracted = extractPrintRow(cell);
            if (!extracted) return;

            collectedRows.push(extracted.values);
            cell.replaceChildren(createCopyPanel(extracted.textLine));
        });

        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.className = 'js-wc-enhancer-export';
        exportButton.textContent = '导出CSV';
        Object.assign(exportButton.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '9999',
            padding: '10px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
        });
        exportButton.addEventListener('click', () => downloadCsv(collectedRows));
        document.body.appendChild(exportButton);
    }

    const path = location.pathname;
    if (path.startsWith('/User/Favorites')) {
        initFavoritesPage();
    } else if (path === '/Print' || path.startsWith('/Print/')) {
        if (document.readyState === 'complete') {
            initPrintPage();
        } else {
            window.addEventListener('load', initPrintPage, { once: true });
        }
    } else if (path.startsWith('/Circle/') && !path.startsWith('/Circle/List')) {
        initCirclePage();
    }
})();
