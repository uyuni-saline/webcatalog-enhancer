// ==UserScript==
// @name         WebCatalog Enhancer
// @namespace    https://github.com/uyuni-saline/webcatalog-enhancer
// @version      2.18.0
// @description  增强Comike及COMITIA Web Catalog的社团信息整理、复制与导出功能
// @author       Saline
// @homepageURL  https://github.com/uyuni-saline/webcatalog-enhancer
// @supportURL   https://github.com/uyuni-saline/webcatalog-enhancer/issues
// @updateURL    https://raw.githubusercontent.com/uyuni-saline/webcatalog-enhancer/main/webcatalog-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/uyuni-saline/webcatalog-enhancer/main/webcatalog-enhancer.user.js
// @match        https://classic-webcatalog.circle.ms/User/Favorites*
// @match        https://classic-webcatalog.circle.ms/Circle/*
// @match        https://classic-webcatalog-free.circle.ms/Circle/*
// @match        https://classic-webcatalog.circle.ms/Print*
// @match        https://comitia-webcatalog.net/list*
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

    const FAVORITE_STORE_BUTTONS = {
        melonbooks: {
            label: 'Melonbooks',
            iconUrl: 'https://docs.circle.ms/parts/comikewebcatalog/onlinebookstore/melonbooks/icon.png'
        },
        booth: {
            label: 'BOOTH',
            iconUrl: 'https://docs.circle.ms/parts/comikewebcatalog/onlinebookstore/booth/icon.png'
        }
    };

    const PRINT_DETAIL_BUTTONS = {
        pixiv: {
            label: 'Pixiv',
            iconUrl: 'https://classic-webcatalog.circle.ms/common/images/common/img_icon_pixiv_on.png'
        },
        x: {
            label: 'X(Twitter)',
            iconUrl: 'https://classic-webcatalog.circle.ms/common/images/common/img_icon_twitter_on.png'
        },
        website: {
            label: '主页',
            iconUrl: 'https://classic-webcatalog.circle.ms/common/images/common/img_icon_myhome_on.png'
        },
        melonbooks: FAVORITE_STORE_BUTTONS.melonbooks,
        booth: FAVORITE_STORE_BUTTONS.booth
    };

    const PRINT_DETAIL_LINK_KEYS = ['pixiv', 'x', 'website', 'melonbooks', 'booth'];

    const ILLEGAL_FILENAME_CHARACTERS = {
        '\\': '＼',
        '/': '／',
        ':': '：',
        '*': '＊',
        '?': '？',
        '"': '＂',
        '<': '＜',
        '>': '＞',
        '|': '｜'
    };

    const WINDOWS_RESERVED_NAMES = new Set([
        'CON', 'PRN', 'AUX', 'NUL',
        ...Array.from({ length: 9 }, (_value, index) => `COM${index + 1}`),
        ...Array.from({ length: 9 }, (_value, index) => `LPT${index + 1}`)
    ]);

    const circleDetailRequests = new Map();

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

    function createCopyPanel(text, options = {}) {
        const { boxed = true, showFeedback = true } = options;
        const panel = document.createElement('div');
        panel.className = 'wc-enhancer-copy-panel';
        panel.style.backgroundColor = boxed ? 'white' : 'transparent';
        panel.style.padding = boxed ? '10px' : '0';
        panel.style.border = boxed ? '1px solid black' : 'none';
        panel.style.margin = boxed ? '10px 0' : '0';
        panel.style.cursor = 'pointer';
        panel.title = '点击复制';
        panel.textContent = text;

        panel.addEventListener('click', () => {
            copyToClipboard(text)
                .then(() => {
                    if (!showFeedback) return;
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

    function ensureFavoriteCopyButtons(circleLink, details = {}) {
        const parent = circleLink?.parentElement;
        if (!parent) return null;

        let container = parent.querySelector('.js-wc-enhancer-favorite-copy-buttons');
        if (!container) {
            container = document.createElement('span');
            container.className = 'js-wc-enhancer-favorite-copy-buttons';
            circleLink.insertAdjacentElement('afterend', container);
        }

        const buttonDefinitions = [
            { key: 'placementText', label: '摊位' },
            { key: 'circleName', label: '社团' },
            { key: 'authorName', label: '作者' }
        ];

        buttonDefinitions.forEach(({ key, label }) => {
            const buttonClass = `js-wc-enhancer-copy-${key}`;
            let button = container.querySelector(`button.${buttonClass}`);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = buttonClass;
                button._wcEnhancerLabel = label;
                Object.assign(button.style, {
                    marginLeft: key === 'placementText' ? '6px' : '4px',
                    padding: '1px 6px',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    cursor: 'pointer',
                    verticalAlign: 'middle'
                });

                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const text = button._wcEnhancerCopyValue || '';
                    if (!text) return;

                    copyToClipboard(text)
                        .then(() => {
                            button.textContent = '已复制';
                            if (button._wcEnhancerResetTimer) {
                                window.clearTimeout(button._wcEnhancerResetTimer);
                            }
                            button._wcEnhancerResetTimer = window.setTimeout(() => {
                                button.textContent = button._wcEnhancerLabel;
                                button._wcEnhancerResetTimer = null;
                            }, 1500);
                        })
                        .catch(error => {
                            console.error(`无法复制${label}信息：`, error);
                        });
                });
                container.appendChild(button);
            }

            const value = details[key] || '';
            button._wcEnhancerCopyValue = value;
            if (!button._wcEnhancerResetTimer) button.textContent = label;
            button.title = value ? `复制${label}：${value}` : `暂无${label}信息`;
            button.setAttribute('aria-label', button.title);
            button.disabled = !value;
            button.style.cursor = value ? 'pointer' : 'default';
        });

        return container;
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

    function resolveFavoriteXUrl(memoText, detailXUrl) {
        return extractXUrlFromText(memoText) || normalizeXUrl(detailXUrl);
    }

    function findCircleMemoText(root = document) {
        return root.querySelector(
            '.m-favorite-control [data-bind*="text: favMemo"]'
        )?.textContent.trim() || '';
    }

    function safeFilenameBase(value, maxLength = 180) {
        const normalized = Array.from(String(value || ''), character => {
            const codePoint = character.codePointAt(0);
            if (codePoint >= 0xFF21 && codePoint <= 0xFF3A) {
                return String.fromCodePoint(codePoint - 0xFEE0);
            }
            if (codePoint >= 0xFF41 && codePoint <= 0xFF5A) {
                return String.fromCodePoint(codePoint - 0xFEE0);
            }
            return character;
        }).join('');
        let cleaned = Array.from(normalized, character => {
            if (character.codePointAt(0) < 32) return '';
            return ILLEGAL_FILENAME_CHARACTERS[character] || character;
        }).join('');

        cleaned = cleaned.replace(/\s+/gu, ' ').replace(/^[ .]+|[ .]+$/gu, '');
        if (!cleaned) cleaned = '未命名';
        if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) cleaned = `_${cleaned}`;
        return Array.from(cleaned).slice(0, maxLength).join('').replace(/[ .]+$/gu, '');
    }

    function buildCircleAuthor(circleName, authorName) {
        const original = `[${circleName} (${authorName})]`;
        const cleaned = safeFilenameBase(original);
        return {
            original,
            cleaned,
            changed: original !== cleaned
        };
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

    function normalizeWebsiteUrl(url, baseUrl = location.href) {
        if (!url || !String(url).trim()) return '';
        try {
            const parsed = new URL(url, baseUrl);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                ? parsed.href
                : '';
        } catch (_error) {
            return '';
        }
    }

    function extractLinkedIcon(root, srcFragment, baseUrl, fallbackLabel) {
        const icon = root.querySelector(`img[src*="${srcFragment}"]`);
        const link = icon?.closest('a');
        const url = normalizeWebsiteUrl(link?.getAttribute('href') || '', baseUrl);
        const iconUrl = normalizeWebsiteUrl(icon?.getAttribute('src') || '', baseUrl);

        if (!url || !iconUrl) return null;
        return {
            url,
            iconUrl,
            alt: icon.getAttribute('alt') || fallbackLabel,
            title: icon.getAttribute('title') || fallbackLabel
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

        // 克隆并替换原链接，移除网站原有的Knockout点击监听。
        const linkedIcon = icon.cloneNode(true);
        linkedIcon.removeAttribute('data-bind');
        activateIcon(linkedIcon);

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'js-wc-enhancer-icon-link';

        const originalLink = icon.parentElement?.matches('a') ? icon.parentElement : null;
        if (originalLink) {
            originalLink.replaceWith(link);
        } else {
            icon.replaceWith(link);
        }
        link.appendChild(linkedIcon);
    }

    function fetchCircleDetails(circleUrl) {
        if (circleDetailRequests.has(circleUrl)) {
            return circleDetailRequests.get(circleUrl);
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
                    'img[alt="X(Twitter)"][src*="img_icon_twitter_"]'
                );
                const pixivIcon = detailDocument.querySelector(
                    'img[alt="pixiv"][src*="img_icon_pixiv_on.png"]'
                );
                const websiteIcon = detailDocument.querySelector(
                    'img[src*="img_icon_myhome_on.png"]'
                );
                const circleInfo = extractCircleInfo(detailDocument);
                const melonbooks = extractLinkedIcon(
                    detailDocument,
                    'onlinebookstore/melonbooks/icon.png',
                    circleUrl,
                    'Melonbooks'
                );
                const booth = extractLinkedIcon(
                    detailDocument,
                    'onlinebookstore/booth/icon.png',
                    circleUrl,
                    'BOOTH'
                );

                return {
                    x: normalizeXUrl(
                        xIcon?.closest('a')?.getAttribute('href') || ''
                    ) || extractXUrlFromText(findCircleMemoText(detailDocument)),
                    pixiv: normalizePixivUrl(
                        pixivIcon?.closest('a')?.getAttribute('href') || ''
                    ),
                    website: normalizeWebsiteUrl(
                        websiteIcon?.closest('a')?.getAttribute('href') || '',
                        circleUrl
                    ),
                    melonbooks,
                    booth,
                    circleText: circleInfo.hasPlacement ? circleInfo.spaceInfo : '',
                    placementText: circleInfo.hasPlacement ? circleInfo.text : '',
                    circleName: safeFilenameBase(circleInfo.circleName),
                    authorName: safeFilenameBase(circleInfo.authorName)
                };
            })
            .catch(error => {
                circleDetailRequests.delete(circleUrl);
                throw error;
            });

        circleDetailRequests.set(circleUrl, request);
        return request;
    }

    function removeFavoriteIconButton(icon) {
        if (!icon) return;
        const item = icon.closest('li');
        if (item) {
            item.remove();
        } else {
            icon.remove();
        }
    }

    function ensureFavoriteStoreLink(supportRow, insertionPoint, storeKey, store) {
        const itemClass = `js-wc-enhancer-store-${storeKey}`;
        const buttonInfo = FAVORITE_STORE_BUTTONS[storeKey];
        let item = supportRow?.querySelector(`li.${itemClass}`) || null;

        if (!buttonInfo || !insertionPoint) return insertionPoint;

        if (!item) {
            item = document.createElement('li');
            item.className = itemClass;

            const link = document.createElement('a');
            link.className = 'js-wc-enhancer-icon-link js-wc-enhancer-store-link';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            const icon = document.createElement('img');
            link.appendChild(icon);
            item.appendChild(link);
            insertionPoint.insertAdjacentElement('afterend', item);
        }

        const link = item.querySelector('a');
        const icon = item.querySelector('img');
        const hasLink = Boolean(store?.url);

        icon.src = store?.iconUrl || buttonInfo.iconUrl;
        icon.alt = store?.alt || buttonInfo.label;
        icon.title = store?.title || buttonInfo.label;
        icon.style.filter = hasLink ? '' : 'grayscale(100%)';
        icon.style.opacity = hasLink ? '' : '0.45';
        icon.style.cursor = hasLink ? 'pointer' : 'default';
        link.style.cursor = hasLink ? 'pointer' : 'default';

        if (hasLink) {
            link.href = store.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.removeAttribute('aria-disabled');
            link.removeAttribute('tabindex');
        } else {
            link.removeAttribute('href');
            link.removeAttribute('target');
            link.removeAttribute('rel');
            link.setAttribute('aria-disabled', 'true');
            link.tabIndex = -1;
        }
        return item;
    }

    function customizeFavoriteSupportButtons(icons, details) {
        removeFavoriteIconButton(icons.niconico);
        removeFavoriteIconButton(icons.clipstudio);

        let insertionPoint = icons.website?.closest('li') || null;
        insertionPoint = ensureFavoriteStoreLink(
            icons.supportRow,
            insertionPoint,
            'melonbooks',
            details.melonbooks
        );
        ensureFavoriteStoreLink(
            icons.supportRow,
            insertionPoint,
            'booth',
            details.booth
        );
    }

    function initFavoritesPage() {
        let updateScheduled = false;

        function findCircleLink(cell) {
            let row = cell.closest('tr')?.previousElementSibling;

            while (row && !row.matches('tr.webcatalog-circle-list-detail')) {
                row = row.previousElementSibling;
            }

            return row?.querySelector(
                'td.infotable-circlename a[href*="/Circle/"]'
            ) || null;
        }

        function findFavoriteSupportIcons(cell) {
            const supportRow = cell.closest('tr')?.nextElementSibling;
            return {
                supportRow,
                x: supportRow?.querySelector('img.support-list-twitter') || null,
                pixiv: supportRow?.querySelector('img.support-list-pixiv') || null,
                website: supportRow?.querySelector('img.support-list-myhome') || null,
                niconico: supportRow?.querySelector('img.support-list-niconico') || null,
                clipstudio: supportRow?.querySelector('img.support-list-clipstudio') || null
            };
        }

        function applyFavoriteDetails(cell, details) {
            const icons = findFavoriteSupportIcons(cell);
            customizeFavoriteSupportButtons(icons, details);
            overrideIconLink(icons.x, details.x, true);
            overrideIconLink(icons.pixiv, details.pixiv);
            overrideIconLink(icons.website, details.website);

            const circleLink = findCircleLink(cell);
            if (circleLink) {
                if (details.circleText &&
                    circleLink.textContent.trim() !== details.circleText) {
                    circleLink.textContent = details.circleText;
                }
                ensureFavoriteCopyButtons(circleLink, details);
            }
        }

        async function resolveFavoriteDetails(cell) {
            const memo = cell.querySelector(SELECTORS.favoriteMemo);
            const circleUrl = findCircleLink(cell)?.href || '';
            let detailInfo = {
                x: '',
                pixiv: '',
                website: '',
                melonbooks: null,
                booth: null,
                circleText: '',
                placementText: '',
                circleName: '',
                authorName: ''
            };

            try {
                if (circleUrl) detailInfo = await fetchCircleDetails(circleUrl);
            } catch (error) {
                console.error(`无法读取社团详情页：${circleUrl}`, error);
            }

            const resolvedDetails = {
                ...detailInfo,
                x: resolveFavoriteXUrl(memo?.textContent || '', detailInfo.x)
            };
            cell._wcEnhancerDetailInfo = detailInfo;
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
                    const detailInfo = cell._wcEnhancerDetailInfo || cell._wcEnhancerDetails || {
                        x: '',
                        pixiv: '',
                        website: '',
                        melonbooks: null,
                        booth: null,
                        circleText: '',
                        placementText: '',
                        circleName: '',
                        authorName: ''
                    };
                    const resolvedDetails = {
                        ...detailInfo,
                        x: resolveFavoriteXUrl(memo.textContent, detailInfo.x)
                    };
                    cell._wcEnhancerDetails = resolvedDetails;
                    applyFavoriteDetails(cell, resolvedDetails);
                    return;
                }

                cell.dataset.wcEnhancerLinksState = 'loading';
                customizeFavoriteSupportButtons(findFavoriteSupportIcons(cell), {
                    melonbooks: null,
                    booth: null
                });
                ensureFavoriteCopyButtons(findCircleLink(cell));
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
        const circleAuthorInfo = buildCircleAuthor(circleName, authorName);

        return {
            ...placement,
            circleName,
            authorName,
            circleAuthor: circleAuthorInfo.cleaned,
            originalCircleAuthor: circleAuthorInfo.original,
            circleAuthorChanged: circleAuthorInfo.changed,
            hasPlacement: Boolean(spaceName),
            spaceInfo: `${placement.text} ${circleAuthorInfo.cleaned}`.trim()
        };
    }

    function createCircleAuthorCopySection(originalText, cleanedText, changed) {
        if (!changed) return createCopyPanel(cleanedText);

        const comparison = document.createElement('div');
        comparison.className = 'js-wc-enhancer-circle-author-comparison';
        Object.assign(comparison.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px'
        });

        const originalPanel = createCopyPanel(originalText);
        originalPanel.title = '点击复制清洗前文本';
        originalPanel.style.marginRight = '0';

        const cleanedPanel = createCopyPanel(cleanedText);
        cleanedPanel.title = '点击复制清洗后文本';
        cleanedPanel.style.color = 'red';
        cleanedPanel.style.marginLeft = '0';

        comparison.appendChild(originalPanel);
        comparison.appendChild(cleanedPanel);
        return comparison;
    }

    function initCirclePage() {
        const target = document.querySelector(SELECTORS.item);
        if (!target || target.querySelector('.js-wc-enhancer-circle-info')) return;

        const {
            circleAuthor,
            originalCircleAuthor,
            circleAuthorChanged,
            spaceInfo
        } = extractCircleInfo();

        const container = document.createElement('div');
        container.className = 'js-wc-enhancer-circle-info';
        container.appendChild(createCopyPanel(spaceInfo));
        container.appendChild(createCircleAuthorCopySection(
            originalCircleAuthor,
            circleAuthor,
            circleAuthorChanged
        ));

        const twitterIcon = document.querySelector(
            'img[alt="X(Twitter)"][src*="img_icon_twitter_"]'
        );
        const twitterUrl = normalizeXUrl(
            twitterIcon?.closest('a')?.getAttribute('href') || ''
        ) || extractXUrlFromText(findCircleMemoText());
        overrideIconLink(twitterIcon, twitterUrl, true);
        const twitterInfo = `${twitterUrl || 'NoLink'} ${circleAuthor}`;
        container.appendChild(createCopyPanel(twitterInfo));
        target.appendChild(container);
    }

    function getDetailLinkUrl(detail) {
        return typeof detail === 'string' ? detail : detail?.url || '';
    }

    function updatePrintCsvLinks(values, details = {}) {
        const firstLinkColumn = 7;
        PRINT_DETAIL_LINK_KEYS.forEach((key, index) => {
            values[firstLinkColumn + index] = getDetailLinkUrl(details[key]);
        });
    }

    function renderPrintDetailButtons(memoCell, details = {}) {
        if (!memoCell) return;

        let container = memoCell.querySelector('.js-wc-enhancer-print-links');
        if (!container) {
            container = document.createElement('div');
            container.className = 'js-wc-enhancer-print-links';
            Object.assign(container.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '4px'
            });
            memoCell.appendChild(container);
        }

        PRINT_DETAIL_LINK_KEYS.forEach(key => {
            const buttonInfo = PRINT_DETAIL_BUTTONS[key];
            const detail = details[key];
            const url = getDetailLinkUrl(detail);
            const iconUrl = typeof detail === 'object' && detail?.iconUrl
                ? detail.iconUrl
                : buttonInfo.iconUrl;
            const label = typeof detail === 'object' && detail?.alt
                ? detail.alt
                : buttonInfo.label;
            const linkClass = `js-wc-enhancer-print-link-${key}`;
            let link = container.querySelector(`a.${linkClass}`);

            if (!link) {
                link = document.createElement('a');
                link.className = `js-wc-enhancer-print-link ${linkClass}`;
                Object.assign(link.style, {
                    display: 'inline-flex',
                    lineHeight: '0'
                });

                const icon = document.createElement('img');
                Object.assign(icon.style, {
                    width: '20px',
                    height: '20px',
                    objectFit: 'contain'
                });
                link.appendChild(icon);
                container.appendChild(link);
            }

            const icon = link.querySelector('img');
            icon.src = iconUrl;
            icon.alt = label;
            icon.title = url ? label : `${label}（无链接）`;
            icon.style.filter = url ? '' : 'grayscale(100%)';
            icon.style.opacity = url ? '' : '0.45';
            icon.style.cursor = url ? 'pointer' : 'default';
            link.style.cursor = url ? 'pointer' : 'default';
            link.setAttribute('aria-label', icon.title);

            if (url) {
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.removeAttribute('aria-disabled');
                link.removeAttribute('tabindex');
            } else {
                link.removeAttribute('href');
                link.removeAttribute('target');
                link.removeAttribute('rel');
                link.setAttribute('aria-disabled', 'true');
                link.tabIndex = -1;
            }
        });
    }

    function extractPrintRow(cell) {
        const placement = cell.querySelector('span.h-text--bold.h-text--center');
        if (!placement) return null;

        const row = cell.closest('tr');
        const memoCell = row?.querySelector('td.table-column-memo') || null;
        const memo = memoCell?.innerText.trim() || '';
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
        const circleAuthor = buildCircleAuthor(circleName, author).cleaned;
        const textLine = `${dateSpace} ${circleAuthor}`;

        return {
            values: [textLine, dateSpace, circleName, author, memo, colorClass, circleLink],
            textLine,
            memo,
            memoCell,
            circleLink
        };
    }

    function buildCsv(rows) {
        const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
        const header = [
            '合并',
            '摊位',
            '社团',
            '作者',
            '备注',
            '颜色',
            '社团详情',
            'Pixiv',
            'X',
            '主页',
            'Melonbooks',
            'BOOTH'
        ];
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
        const detailTasks = [];
        document.querySelectorAll('td').forEach(cell => {
            const extracted = extractPrintRow(cell);
            if (!extracted) return;

            const memoXUrl = extractXUrlFromText(extracted.memo);
            const initialDetails = { x: memoXUrl };
            const csvValues = [...extracted.values, '', '', '', '', ''];
            collectedRows.push(csvValues);
            updatePrintCsvLinks(csvValues, initialDetails);
            renderPrintDetailButtons(extracted.memoCell, initialDetails);

            if (extracted.circleLink) {
                const detailTask = fetchCircleDetails(extracted.circleLink)
                    .then(details => {
                        const resolvedDetails = {
                            ...details,
                            x: details.x || memoXUrl
                        };
                        updatePrintCsvLinks(csvValues, resolvedDetails);
                        renderPrintDetailButtons(extracted.memoCell, resolvedDetails);
                    })
                    .catch(error => {
                        console.error(`无法读取社团详情页：${extracted.circleLink}`, error);
                    });
                detailTasks.push(detailTask);
            }

            cell.replaceChildren(createCopyPanel(extracted.textLine, {
                boxed: false,
                showFeedback: false
            }));
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
        exportButton.addEventListener('click', async () => {
            if (exportButton.disabled) return;

            exportButton.disabled = true;
            exportButton.textContent = '整理CSV…';
            try {
                await Promise.allSettled(detailTasks);
                downloadCsv(collectedRows);
            } finally {
                exportButton.disabled = false;
                exportButton.textContent = '导出CSV';
            }
        });
        document.body.appendChild(exportButton);
    }

    function readDirectText(element) {
        if (!element) return '';
        return Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent)
            .join('')
            .trim();
    }

    function initComitiaListPage() {
        const table = document.querySelector('#list_table');
        const tableContainer = document.querySelector('#list_table_div');
        if (!table || !tableContainer) return;

        const style = document.createElement('style');
        style.textContent = `
            body .main-container > .sub-container-1,
            body .main-container > .sub-container-3,
            body .modal-ad {
                display: none !important;
            }
            body .main-container > .sub-container-2 {
                width: 100%;
            }
            @media screen and (orientation: landscape) {
                body .container.main-container {
                    max-width: none;
                    width: 75vw;
                }
            }
            @media screen and (orientation: portrait) {
                body .container.main-container {
                    max-width: 100%;
                    width: 100%;
                }
            }
            #list_table_div {
                overflow-x: auto;
            }
            #list_table_div:not(.cut-list-mode) #list_table {
                table-layout: auto;
            }
            #list_table_div:not(.cut-list-mode) #list_table .list-no,
            #list_table_div:not(.cut-list-mode) #list_table .list-sel,
            #list_table_div:not(.cut-list-mode) #list_table .list-vst,
            #list_table_div:not(.cut-list-mode) #list_table .list-sp,
            #list_table_div:not(.cut-list-mode) #list_table .list-link,
            #list_table_div:not(.cut-list-mode) #list_table .list-genre,
            #list_table_div:not(.cut-list-mode) #list_table .list-name,
            #list_table_div:not(.cut-list-mode) #list_table .wc-comitia-author {
                width: 1%;
                white-space: nowrap;
            }
            #list_table_div:not(.cut-list-mode) #list_table .list-pri {
                max-width: 2rem;
                min-width: 2rem;
                width: 2rem;
            }
            #list_table_div:not(.cut-list-mode) #list_table .list-sp {
                min-width: 5.75rem;
            }
            #list_table_div:not(.cut-list-mode) #list_table td.list-name > a,
            #list_table_div:not(.cut-list-mode) #list_table .wc-comitia-author-text {
                display: block;
                max-width: 14rem;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #list_table_div:not(.cut-list-mode) #list_table th.max-layout-only,
            #list_table_div:not(.cut-list-mode) #list_table td.max-layout-only,
            #list_table_div:not(.cut-list-mode) #list_table th.desktop-only,
            #list_table_div:not(.cut-list-mode) #list_table td.desktop-only,
            #list_table_div:not(.cut-list-mode) #list_table th.mobile-hide {
                display: table-cell !important;
            }
            #list_table_div:not(.cut-list-mode) #list_table th.list-info:not(.cut-list-view),
            #list_table_div:not(.cut-list-mode) #list_table td.list-info {
                display: table-cell !important;
                min-width: 12rem;
            }
            #list_table_div:not(.cut-list-mode) #list_table .cut-list-view,
            #list_table_div:not(.cut-list-mode) #list_table td.list-cut {
                display: none !important;
            }
            #list_table .wc-comitia-copy-button {
                appearance: none;
                background: white;
                border: 1px solid #b5b5b5;
                border-radius: 3px;
                box-shadow: 0 1px 2px rgb(0 0 0 / 15%);
                color: #222;
                cursor: pointer;
                font-size: 0.75rem;
                line-height: 1.4;
                padding: 0.15rem 0.4rem;
                vertical-align: middle;
                white-space: nowrap;
            }
            #list_table .wc-comitia-copy-button:hover {
                background: #f2f2f2;
            }
            #list_table .wc-comitia-copy-button:focus-visible {
                outline: 2px solid #222;
                outline-offset: 1px;
            }
        `;
        document.head.appendChild(style);

        function ensureListHeader() {
            const headerRow = table.querySelector('tr.circle-root:not(.list-row)');
            const nameHeader = headerRow?.querySelector('th.list-name');
            if (!nameHeader) return;

            if (nameHeader.textContent !== 'サークル名') {
                nameHeader.textContent = 'サークル名';
            }
            if (headerRow.querySelector('th.wc-comitia-author')) return;

            const authorHeader = document.createElement('th');
            authorHeader.className = 'wc-comitia-author cut-list-hide';
            authorHeader.textContent = '作者';
            nameHeader.insertAdjacentElement('afterend', authorHeader);
        }

        function ensureCopyButton(container, className) {
            let button = container.querySelector(`.${className}`);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = `wc-comitia-copy-button ${className}`;
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const value = button._wcEnhancerCopyValue || '';
                    if (!value) return;
                    copyToClipboard(value).catch(error => {
                        console.error('无法复制COMITIA社团信息：', error);
                    });
                });
                container.appendChild(button);
            }
            return button;
        }

        function configureCopyButton(button, buttonText, copyText) {
            if (button.textContent !== buttonText) {
                button.textContent = buttonText;
            }
            button._wcEnhancerCopyValue = copyText;
            button.title = `复制：${copyText}`;
            button.setAttribute('aria-label', button.title);
            button.disabled = !copyText;
        }

        function ensureListCopyButton(row, spaceCell, placement, copyText) {
            const button = ensureCopyButton(
                spaceCell,
                'wc-comitia-list-copy-button'
            );
            Array.from(spaceCell.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .forEach(node => node.remove());
            configureCopyButton(button, `${placement}📋`, copyText);
            spaceCell.dataset.wcEnhancerPlacement = placement;
            row.dataset.wcEnhancerCopyText = copyText;
        }

        function readRowInfo(row) {
            const spaceCell = row.querySelector('td.list-sp');
            const nameCell = row.querySelector('td.list-name');
            if (!spaceCell || !nameCell) return null;

            const placement = readDirectText(spaceCell) ||
                spaceCell.dataset.wcEnhancerPlacement || '';
            const nameElement = nameCell.querySelector('.circle-chk-name');
            if (!nameElement) return null;

            const authorName = row.querySelector('.list-info .circle-chk-pn')?.textContent.trim() || '';
            const circleName = nameElement.dataset.wcEnhancerCircleName ||
                nameElement.textContent.trim();
            if (nameElement.textContent.trim() !== circleName) {
                nameElement.textContent = circleName;
            }
            delete nameElement.dataset.wcEnhancerCircleName;
            delete nameElement.dataset.wcEnhancerCombinedName;
            nameCell.title = circleName;

            const circleAuthor = buildCircleAuthor(circleName, authorName).cleaned;
            return {
                authorName,
                circleName,
                copyText: placement ? `${placement} ${circleAuthor}` : circleAuthor,
                nameCell,
                placement,
                spaceCell
            };
        }

        function enhanceListRow(row, info) {
            let authorCell = row.querySelector('td.wc-comitia-author');
            if (!authorCell) {
                authorCell = document.createElement('td');
                authorCell.className = 'wc-comitia-author cut-list-hide';
                info.nameCell.insertAdjacentElement('afterend', authorCell);
            }
            let authorText = authorCell.querySelector('.wc-comitia-author-text');
            if (!authorText) {
                authorText = document.createElement('span');
                authorText.className = 'wc-comitia-author-text';
                authorCell.appendChild(authorText);
            }
            if (authorText.textContent !== info.authorName) {
                authorText.textContent = info.authorName;
            }
            authorCell.title = info.authorName;

            ensureListCopyButton(
                row,
                info.spaceCell,
                info.placement,
                info.copyText
            );
        }

        function enhanceCutRow(row, info) {
            const linkRow = Array.from(
                row.querySelectorAll('.list-info .cut-info-row')
            ).find(candidate => candidate.querySelector('.cut-info-label')
                ?.textContent.trim() === 'リンク');
            const buttonGroup = linkRow?.querySelector('.btn-group');
            if (!buttonGroup) return;

            const button = ensureCopyButton(
                buttonGroup,
                'wc-comitia-cut-copy-button'
            );
            configureCopyButton(button, '📋', info.copyText);
            row.dataset.wcEnhancerCopyText = info.copyText;
        }

        let updateScheduled = false;
        function enhanceList() {
            const cutMode = tableContainer.classList.contains('cut-list-mode');
            if (!cutMode) ensureListHeader();
            table.querySelectorAll('tr.circle-root.list-row').forEach(row => {
                const info = readRowInfo(row);
                if (!info) return;
                if (cutMode) {
                    enhanceCutRow(row, info);
                } else {
                    enhanceListRow(row, info);
                }
            });
        }
        function scheduleUpdate() {
            if (updateScheduled) return;
            updateScheduled = true;
            window.requestAnimationFrame(() => {
                updateScheduled = false;
                enhanceList();
            });
        }

        enhanceList();
        new MutationObserver(scheduleUpdate).observe(table, {
            childList: true,
            subtree: true,
            characterData: true
        });
        new MutationObserver(scheduleUpdate).observe(tableContainer, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    const path = location.pathname;
    if (location.hostname === 'comitia-webcatalog.net' &&
        (path === '/list' || path.startsWith('/list/'))) {
        initComitiaListPage();
    } else if (path.startsWith('/User/Favorites')) {
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
