// ==UserScript==
// @name         Comike Web Catalog Enhancer
// @namespace    https://github.com/uyuni-saline/webcatalog-enhancer
// @version      2.6.0
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

    // 每一天分别保存映射，避免不同日期的摊位配置互相影响。
    const HALL_MAPPINGS = {
        day1: {
            東: [
                { hall: '1', letters: 'イウエオカキクケコサシス', ranges: { ア: [1, 39] } },
                { hall: '2', letters: 'セソタチツテトナニヌネノハ', ranges: { ア: [40, 56] } },
                { hall: '3', letters: 'ヒフヘホマミムメモヤユヨ', ranges: { ア: [57, 95] } },
                { hall: '7', letters: 'ABCDEFGHIJKLMNOPQRSTUVW' }
            ],
            西: [
                { hall: '1', letters: 'つてとなにぬねのはひふへほまみむめ' },
                { hall: '2', letters: 'あいうえおかきくけこさしすせそたち' }
            ],
            南: [
                { hall: '1', letters: 'klmnopqrst', ranges: { a: [33, 54] } },
                { hall: '2', letters: 'bcdefghij', ranges: { a: [1, 32] } }
            ]
        },
        day2: {
            東: [
                { hall: '1', letters: 'イウエオカキクケコサシス', ranges: { ア: [1, 39] } },
                { hall: '2', letters: 'セソタチツテトナニヌネノハ', ranges: { ア: [40, 56] } },
                { hall: '3', letters: 'ヒフヘホマミムメモヤユヨ', ranges: { ア: [57, 95] } },
                { hall: '7', letters: 'ABCDEFGHIJKLMPQRSTUVW' }
            ],
            西: [
                { hall: '1', letters: 'つてとなにぬねのはひふへほまみむめ' },
                { hall: '2', letters: 'あいうえおかきくけこさしすせそたち' }
            ],
            南: [
                { hall: '1', letters: 'klmnopqrst', ranges: { a: [33, 54] } },
                { hall: '2', letters: 'bcdefghij', ranges: { a: [1, 32] } }
            ]
        }
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
        const detailRequests = new Map();

        function findCircleLink(cell) {
            let row = cell.closest('tr')?.previousElementSibling;

            while (row && !row.matches('tr.webcatalog-circle-list-detail')) {
                row = row.previousElementSibling;
            }

            return row?.querySelector(
                'td.infotable-circlename a[href*="/Circle/"]'
            ) || null;
        }

        function fetchCircleDetails(circleUrl) {
            if (detailRequests.has(circleUrl)) {
                return detailRequests.get(circleUrl);
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
                    const circleInfo = extractCircleInfo(detailDocument);

                    return {
                        x: normalizeXUrl(
                            xIcon?.closest('a')?.getAttribute('href') || ''
                        ),
                        pixiv: normalizePixivUrl(
                            pixivIcon?.closest('a')?.getAttribute('href') || ''
                        ),
                        website: normalizeWebsiteUrl(
                            websiteIcon?.closest('a')?.getAttribute('href') || ''
                        ),
                        circleText: circleInfo.hasPlacement ? circleInfo.spaceInfo : ''
                    };
                })
                .catch(error => {
                    detailRequests.delete(circleUrl);
                    throw error;
                });

            detailRequests.set(circleUrl, request);
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

            const activateIcon = targetIcon => {
                targetIcon.style.cursor = 'pointer';
                if (!activateTwitterIcon) return;

                const src = targetIcon.getAttribute('src') || '';
                if (src.includes('img_icon_twitter_off.png')) {
                    targetIcon.setAttribute(
                        'src',
                        src.replace('img_icon_twitter_off.png', 'img_icon_twitter_on.png')
                    );
                }
            };

            const existingLink = icon.parentElement?.matches('a.js-wc-enhancer-icon-link')
                ? icon.parentElement
                : null;
            if (existingLink) {
                existingLink.href = url;
                activateIcon(icon);
                return;
            }

            // 克隆图标以移除网站原有的Knockout点击监听，再使用标准链接包装。
            const linkedIcon = icon.cloneNode(true);
            linkedIcon.removeAttribute('data-bind');
            activateIcon(linkedIcon);

            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'js-wc-enhancer-icon-link';
            icon.replaceWith(link);
            link.appendChild(linkedIcon);
        }

        function applyFavoriteDetails(cell, details) {
            const icons = findFavoriteSupportIcons(cell);
            overrideIconLink(icons.x, details.x, true);
            overrideIconLink(icons.pixiv, details.pixiv);
            overrideIconLink(icons.website, details.website);

            const circleLink = findCircleLink(cell);
            if (circleLink && details.circleText &&
                circleLink.textContent.trim() !== details.circleText) {
                circleLink.textContent = details.circleText;
            }
        }

        async function resolveFavoriteDetails(cell) {
            const memo = cell.querySelector(SELECTORS.favoriteMemo);
            const circleUrl = findCircleLink(cell)?.href || '';
            let detailInfo = { x: '', pixiv: '', website: '', circleText: '' };

            try {
                if (circleUrl) detailInfo = await fetchCircleDetails(circleUrl);
            } catch (error) {
                console.error(`无法读取社团详情页：${circleUrl}`, error);
            }

            const resolvedDetails = {
                ...detailInfo,
                x: detailInfo.x || extractXUrlFromText(memo?.textContent || '')
            };
            cell._wcEnhancerDetails = resolvedDetails;
            applyFavoriteDetails(cell, resolvedDetails);
            cell.dataset.wcEnhancerLinksState = 'done';
        }

        function applyFavoriteLinks() {
            document.querySelectorAll(SELECTORS.favoriteCell).forEach(cell => {
                const memoEditButton = cell.querySelector(SELECTORS.memoEditButton);
                const memo = cell.querySelector(SELECTORS.favoriteMemo);
                if (!memoEditButton || !memo) return;

                if (cell.dataset.wcEnhancerLinksState === 'loading') return;
                if (cell.dataset.wcEnhancerLinksState === 'done') {
                    const resolvedDetails = cell._wcEnhancerDetails || {
                        x: '',
                        pixiv: '',
                        website: '',
                        circleText: ''
                    };
                    if (!resolvedDetails.x) {
                        resolvedDetails.x = extractXUrlFromText(memo.textContent);
                    }
                    cell._wcEnhancerDetails = resolvedDetails;
                    applyFavoriteDetails(cell, resolvedDetails);
                    return;
                }

                cell.dataset.wcEnhancerLinksState = 'loading';
                resolveFavoriteDetails(cell);
            });
        }

        function scheduleUpdate() {
            if (updateScheduled) return;
            updateScheduled = true;
            window.requestAnimationFrame(() => {
                updateScheduled = false;
                applyFavoriteLinks();
            });
        }

        applyFavoriteLinks();
        new MutationObserver(scheduleUpdate).observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function findTableValue(label, root = document) {
        for (const th of root.querySelectorAll('th')) {
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

    function getEventDayKey(day) {
        const normalizedDay = String(day || '').normalize('NFKC').trim();
        if (normalizedDay === '土' || normalizedDay === '1日目') return 'day1';
        if (normalizedDay === '日' || normalizedDay === '2日目') return 'day2';
        return '';
    }

    function findHall(day, region, blockLetter, boothNumber) {
        const dayKey = getEventDayKey(day);
        const rules = HALL_MAPPINGS[dayKey]?.[region];
        if (!rules) return '';

        const normalizedLetter = String(blockLetter || '').normalize('NFKC');
        const number = Number(boothNumber);

        for (const rule of rules) {
            if (rule.letters.includes(normalizedLetter)) return rule.hall;

            const range = rule.ranges?.[normalizedLetter];
            if (range && Number.isFinite(number) && number >= range[0] && number <= range[1]) {
                return rule.hall;
            }
        }
        return '';
    }

    function addHallToSpace(day, space) {
        const originalSpace = String(space || '').trim();
        if (!originalSpace) return '';

        const normalizedSpace = originalSpace.normalize('NFKC');
        if (/^[東西南](?:[1237]|\?)/u.test(normalizedSpace)) return originalSpace;

        // 数字后面的a/b是桌位侧标，不纳入场馆判断。
        const match = normalizedSpace.match(/^([東西南])\s*([^\d\s]+)\s*(\d+)/u);
        const hall = match ? findHall(day, match[1], match[2], match[3]) : '';
        return originalSpace.replace(/^([東西南])/u, `$1${hall || '?'}`);
    }

    function formatPlacement(spaceName) {
        const { day, space } = parseSpaceName(spaceName);
        const spaceWithHall = addHallToSpace(day, space);
        return {
            day,
            space,
            spaceWithHall,
            text: `${day}${spaceWithHall}`
        };
    }

    function extractCircleInfo(root = document) {
        const title = root.querySelector('meta[property="og:title"]')?.content || '';
        const circleName = title.split(' | ')[0].trim() || '？';
        const spaceName = findTableValue('配置スペース', root);
        const authorName = findTableValue('執筆者名', root) || 'NoName';
        const placement = formatPlacement(spaceName);
        const circleAuthor = `[${circleName} (${authorName})]`;

        return {
            ...placement,
            circleName,
            authorName,
            circleAuthor,
            hasPlacement: Boolean(spaceName),
            spaceInfo: `${placement.text} ${circleAuthor}`.trim()
        };
    }

    function initCirclePage() {
        const target = document.querySelector(SELECTORS.item);
        if (!target || target.querySelector('.js-wc-enhancer-circle-info')) return;

        const { circleAuthor, spaceInfo } = extractCircleInfo();

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
        const dateSpace = formatPlacement(dayLocation).text;
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
