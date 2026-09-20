// ==UserScript==
// @name         抖店达人采集助手 | Douyin Creator Collector
// @namespace    douyin-daren-helper
// @version      1.0.0
// @description  达人广场资料采集、去重存储、可拖动面板与 CSV 导出
// @match        https://buyin.jinritemai.com/*
// @match        http://buyin.jinritemai.com/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('[达人助手 v1.0.0] 脚本开始执行');

    const STORAGE_KEY = 'daren_collector_v7';
    const PANEL_POSITION_KEY = 'daren_helper_panel_position_v7';
    const LAUNCHER_POSITION_KEY = 'daren_helper_launcher_position_v7';
    const OLD_STORAGE_KEYS = [
        'daren_collector_v6_final',
        'daren_collector_v6',
        'daren_collector_v5',
        'daren_collector_v4_1',
        'daren_collector_v4'
    ];

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    let currentResult = null;
    let isCollapsed = false;


    // =========================================================
    // 数据
    // =========================================================

    function getRecords() {
        try {
            const raw =
                localStorage.getItem(STORAGE_KEY);

            const current =
                JSON.parse(
                    raw
                ) || [];

            if (Array.isArray(current) && raw !== null) {
                return current;
            }

            for (const key of OLD_STORAGE_KEYS) {
                const old =
                    JSON.parse(
                        localStorage.getItem(key)
                    ) || [];

                if (old.length) {
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(old)
                    );

                    return old;
                }
            }

            return [];
        } catch (error) {
            console.error(
                '[达人助手] 读取本地数据失败',
                error
            );

            return [];
        }
    }


    function saveRecords(records) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(records)
        );

        updateCount();
    }


    // =========================================================
    // 通用工具
    // =========================================================

    function isVisible(el) {
        if (!el) {
            return false;
        }

        const rect =
            el.getBoundingClientRect();

        const style =
            getComputedStyle(el);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }


    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    function setStatus(text) {
        const el =
            document.querySelector(
                '#daren-helper-status'
            );

        if (el) {
            el.innerText = text;
        }
    }


    function showToast(
        message,
        duration = 2500
    ) {
        let toast =
            document.querySelector(
                '#daren-helper-toast'
            );

        if (!toast) {
            toast =
                document.createElement(
                    'div'
                );

            toast.id =
                'daren-helper-toast';

            Object.assign(
                toast.style,
                {
                    position: 'fixed',
                    right: '24px',
                    bottom: '340px',
                    zIndex: '2147483647',
                    background: 'rgba(30,30,30,.92)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,.22)',
                    fontSize: '13px',
                    maxWidth: '340px'
                }
            );

            document.body.appendChild(
                toast
            );
        }

        toast.innerText =
            message;

        toast.style.display =
            'block';

        clearTimeout(
            toast.__hideTimer
        );

        toast.__hideTimer =
            setTimeout(
                () => {
                    toast.style.display =
                        'none';
                },
                duration
            );
    }



    // =========================================================
    // 位置 / 拖动
    // =========================================================

    function readSavedPosition(key) {
        try {
            const value =
                JSON.parse(
                    localStorage.getItem(key)
                );

            if (
                value &&
                Number.isFinite(value.left) &&
                Number.isFinite(value.top)
            ) {
                return value;
            }
        } catch {}

        return null;
    }


    function savePosition(
        key,
        left,
        top
    ) {
        localStorage.setItem(
            key,
            JSON.stringify({
                left,
                top
            })
        );
    }


    function clampPosition(
        element,
        left,
        top
    ) {
        const maxLeft =
            Math.max(
                0,
                window.innerWidth -
                element.offsetWidth
            );

        const maxTop =
            Math.max(
                0,
                window.innerHeight -
                element.offsetHeight
            );

        return {
            left:
                Math.max(
                    0,
                    Math.min(
                        left,
                        maxLeft
                    )
                ),

            top:
                Math.max(
                    0,
                    Math.min(
                        top,
                        maxTop
                    )
                )
        };
    }


    function restorePosition(
        element,
        key
    ) {
        const saved =
            readSavedPosition(key);

        if (!saved) {
            return false;
        }

        applyPosition(
            element,
            saved.left,
            saved.top
        );

        return true;
    }


    function applyPosition(
        element,
        left,
        top
    ) {
        const pos =
            clampPosition(
                element,
                left,
                top
            );

        element.style.left =
            `${pos.left}px`;

        element.style.top =
            `${pos.top}px`;

        element.style.right =
            'auto';

        element.style.bottom =
            'auto';

        return pos;
    }


    function makeDraggable({
        element,
        handle,
        storageKey,
        onClick,
        ignoreSelector
    }) {
        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        handle.style.touchAction =
            'none';

        handle.style.userSelect =
            'none';

        handle.addEventListener(
            'pointerdown',
            event => {
                if (
                    ignoreSelector &&
                    event.target.closest(
                        ignoreSelector
                    )
                ) {
                    return;
                }

                dragging = true;
                moved = false;

                const rect =
                    element.getBoundingClientRect();

                startX =
                    event.clientX;

                startY =
                    event.clientY;

                startLeft =
                    rect.left;

                startTop =
                    rect.top;

                element.style.left =
                    `${startLeft}px`;

                element.style.top =
                    `${startTop}px`;

                element.style.right =
                    'auto';

                element.style.bottom =
                    'auto';

                handle.style.cursor =
                    'grabbing';

                try {
                    handle.setPointerCapture(
                        event.pointerId
                    );
                } catch {}

                event.preventDefault();
            }
        );

        handle.addEventListener(
            'pointermove',
            event => {
                if (!dragging) {
                    return;
                }

                const dx =
                    event.clientX -
                    startX;

                const dy =
                    event.clientY -
                    startY;

                if (
                    Math.abs(dx) > 3 ||
                    Math.abs(dy) > 3
                ) {
                    moved = true;
                }

                const pos =
                    clampPosition(
                        element,
                        startLeft + dx,
                        startTop + dy
                    );

                element.style.left =
                    `${pos.left}px`;

                element.style.top =
                    `${pos.top}px`;
            }
        );

        handle.addEventListener(
            'pointerup',
            event => {
                if (!dragging) {
                    return;
                }

                dragging = false;

                handle.style.cursor =
                    'grab';

                try {
                    handle.releasePointerCapture(
                        event.pointerId
                    );
                } catch {}

                const rect =
                    element.getBoundingClientRect();

                savePosition(
                    storageKey,
                    rect.left,
                    rect.top
                );

                if (
                    !moved &&
                    typeof onClick ===
                    'function'
                ) {
                    onClick();
                }
            }
        );
    }


    // =========================================================
    // 当前提取结果
    // =========================================================

    function renderCurrentResult() {
        const box =
            document.querySelector(
                '#daren-helper-current-result'
            );

        if (!box) {
            return;
        }

        if (!currentResult) {
            box.innerHTML = `
                <div style="color:#999;">
                    尚未提取
                </div>
            `;

            return;
        }

        const row = (
            label,
            value,
            isHtml = false
        ) => `
            <div style="
                display:grid;
                grid-template-columns:64px 1fr;
                gap:6px;
                margin-top:5px;
                align-items:start;
            ">
                <span style="color:#888;">
                    ${escapeHtml(label)}
                </span>

                <span style="
                    color:#222;
                    word-break:break-all;
                ">
                    ${
                        isHtml
                            ? value
                            : escapeHtml(
                                value || '未识别'
                            )
                    }
                </span>
            </div>
        `;

        box.innerHTML = `
            ${row(
                '达人名称',
                currentResult.name
            )}

            ${row(
                '抖音号',
                currentResult.douyinId
            )}

            ${row(
                '达人等级',
                currentResult.level
            )}

            ${row(
                '结算总额',
                currentResult.settlement
            )}

            ${row(
                '主页链接',
                currentResult.pageUrl
                    ? `<a
                           href="${escapeHtml(currentResult.pageUrl)}"
                           target="_blank"
                           rel="noopener noreferrer"
                           style="
                               color:#1677ff;
                               text-decoration:none;
                           "
                       >打开主页</a>`
                    : '<span style="color:#999;">未识别</span>',
                true
            )}
        `;
    }


    // =========================================================
    // 1. 达人等级
    // =========================================================

    function getLevel() {
        const el =
            document.querySelector(
                'img[data-author-level]'
            );

        if (!el) {
            console.warn(
                '[达人助手] 找不到达人等级节点'
            );

            return '';
        }

        const value =
            el.getAttribute(
                'data-author-level'
            );

        return value
            ? `LV${value}`
            : '';
    }


    // =========================================================
    // 2. 达人名称
    // =========================================================

    function isReasonableName(text) {
        if (!text) {
            return false;
        }

        const blacklist = [
            '首页',
            '推商品',
            '找达人',
            '管合作',
            '看数据',
            '概览',
            '场景分析',
            '粉丝分析',
            '带货分析',
            '评价详情',
            '潜力合作',
            '结算率高',
            '有联系方式',
            '履约分',
            '达人抖音主页',
            '立即合作'
        ];

        if (
            blacklist.includes(text)
        ) {
            return false;
        }

        if (
            text.includes('粉丝') ||
            text.includes('结算总额')
        ) {
            return false;
        }

        if (
            /^LV\s*\d+$/i.test(text)
        ) {
            return false;
        }

        if (
            /^[\d,.%¥￥\-~～]+$/
                .test(text)
        ) {
            return false;
        }

        return (
            text.length >= 1 &&
            text.length <= 40
        );
    }


    function getDarenName() {
        const levelEl =
            document.querySelector(
                'img[data-author-level]'
            );

        const candidates =
            [
                ...document.querySelectorAll(
                    'span.auxo-dorami-atom-text'
                )
            ]
                .filter(isVisible)
                .map(el => ({
                    el,
                    text:
                        el.textContent
                            ?.trim() || ''
                }))
                .filter(item =>
                    isReasonableName(
                        item.text
                    )
                );

        if (
            levelEl &&
            candidates.length
        ) {
            const lr =
                levelEl
                    .getBoundingClientRect();

            const levelCenterY =
                lr.top +
                lr.height / 2;

            const scored =
                candidates
                    .map(item => {
                        const r =
                            item.el
                                .getBoundingClientRect();

                        const centerY =
                            r.top +
                            r.height / 2;

                        const verticalGap =
                            Math.abs(
                                centerY -
                                levelCenterY
                            );

                        const horizontalGap =
                            r.right <=
                            lr.left + 80
                                ? Math.abs(
                                    lr.left -
                                    r.right
                                )
                                : 1000 +
                                  Math.abs(
                                      r.left -
                                      lr.right
                                  );

                        return {
                            ...item,
                            verticalGap,
                            horizontalGap,
                            score:
                                verticalGap * 6 +
                                horizontalGap
                        };
                    })
                    .filter(item =>
                        item.verticalGap <
                        90
                    )
                    .sort(
                        (a, b) =>
                            a.score -
                            b.score
                    );

            if (
                scored.length &&
                scored[0].score <
                900
            ) {
                return scored[0].text;
            }
        }

        if (candidates.length) {
            return candidates[0].text;
        }

        const lines =
            (
                document.body.innerText ||
                ''
            )
                .split('\n')
                .map(x => x.trim())
                .filter(Boolean);

        const followerIndex =
            lines.findIndex(
                line =>
                    line.includes('粉丝') &&
                    /\d/.test(line)
            );

        if (
            followerIndex !== -1
        ) {
            for (
                let i =
                    followerIndex - 1;

                i >=
                    Math.max(
                        0,
                        followerIndex - 8
                    );

                i--
            ) {
                const candidate =
                    lines[i]
                        .replace(
                            /\bLV\s*\d+\b/ig,
                            ''
                        )
                        .trim();

                if (
                    isReasonableName(
                        candidate
                    )
                ) {
                    return candidate;
                }
            }
        }

        return '';
    }


    // =========================================================
    // 3. 抖音号
    // =========================================================

    function readDouyinId() {
        const el =
            document.querySelector(
                '.qrcode-content-info-account'
            );

        if (!el) {
            return '';
        }

        const text =
            el.textContent
                ?.trim() || '';

        const match =
            text.match(
                /抖音号\s*[：:]\s*(.+)/
            );

        return match
            ? match[1].trim()
            : '';
    }


    // =========================================================
    // 4. 二维码 Hover
    // =========================================================

    function triggerQRHover(qr) {
        if (!qr) {
            return;
        }

        const rect =
            qr.getBoundingClientRect();

        const options = {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX:
                rect.left +
                rect.width / 2,
            clientY:
                rect.top +
                rect.height / 2
        };

        [
            'mouseover',
            'mouseenter',
            'mousemove'
        ].forEach(type => {
            try {
                qr.dispatchEvent(
                    new MouseEvent(
                        type,
                        options
                    )
                );
            } catch {}
        });

        [
            'pointerover',
            'pointerenter',
            'pointermove'
        ].forEach(type => {
            try {
                qr.dispatchEvent(
                    new PointerEvent(
                        type,
                        options
                    )
                );
            } catch {}
        });
    }


    function tryReactHover(qr) {
        let node = qr;

        for (
            let depth = 0;
            depth < 6 && node;
            depth++
        ) {
            const reactKey =
                Object.keys(node)
                    .find(key =>
                        key.startsWith(
                            '__reactProps$'
                        )
                    );

            if (reactKey) {
                const props =
                    node[reactKey];

                [
                    'onMouseEnter',
                    'onMouseOver',
                    'onPointerEnter',
                    'onPointerOver'
                ].forEach(
                    handler => {
                        if (
                            typeof props?.[
                                handler
                            ] ===
                            'function'
                        ) {
                            try {
                                props[handler]({
                                    currentTarget:
                                        node,
                                    target:
                                        node,
                                    type:
                                        handler
                                });
                            } catch {}
                        }
                    }
                );
            }

            node =
                node.parentElement;
        }
    }


    async function getDouyinId() {
        let id =
            readDouyinId();

        if (id) {
            return id;
        }

        const qr =
            document.querySelector(
                '.dp__icon-qrcode'
            );

        if (!qr) {
            return '';
        }

        setStatus(
            '正在读取抖音号...'
        );

        triggerQRHover(qr);
        tryReactHover(qr);

        for (
            let i = 0;
            i < 20;
            i++
        ) {
            await sleep(100);

            id =
                readDouyinId();

            if (id) {
                return id;
            }
        }

        setStatus(
            '请把鼠标移到二维码上'
        );

        showToast(
            '请把鼠标移到“达人抖音主页”右侧二维码上'
        );

        for (
            let i = 0;
            i < 200;
            i++
        ) {
            await sleep(100);

            id =
                readDouyinId();

            if (id) {
                return id;
            }
        }

        return '';
    }


    // =========================================================
    // 5. 带货分析
    // =========================================================

    function findSalesTab() {
        return (
            document.querySelector(
                '#daren-profile-main-tabs-tab-4'
            ) ||
            document.querySelector(
                '[role="tab"][aria-controls="daren-profile-main-tabs-panel-4"]'
            ) ||
            [
                ...document.querySelectorAll(
                    '[role="tab"]'
                )
            ].find(
                el =>
                    el.textContent
                        ?.trim() ===
                    '带货分析'
            ) ||
            null
        );
    }


    async function waitForSalesPage(
        milliseconds = 6000
    ) {
        const loops =
            Math.ceil(
                milliseconds / 100
            );

        for (
            let i = 0;
            i < loops;
            i++
        ) {
            await sleep(100);

            const tab =
                findSalesTab();

            const selected =
                tab?.getAttribute(
                    'aria-selected'
                ) === 'true';

            if (selected) {
                console.log(
                    '[达人助手] 已切换到带货分析 Tab'
                );

                return true;
            }
        }

        return false;
    }


    async function openSalesAnalysis() {
        const tab =
            findSalesTab();

        if (!tab) {
            return false;
        }

        if (
            tab.getAttribute(
                'aria-selected'
            ) === 'true'
        ) {
            return true;
        }

        setStatus(
            '正在进入带货分析...'
        );

        try {
            tab.scrollIntoView({
                block: 'center',
                inline: 'center'
            });
        } catch {}

        try {
            tab.focus();
        } catch {}

        try {
            tab.click();
        } catch {}

        if (
            await waitForSalesPage(
                2500
            )
        ) {
            return true;
        }

        const rect =
            tab.getBoundingClientRect();

        const options = {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX:
                rect.left +
                rect.width / 2,
            clientY:
                rect.top +
                rect.height / 2
        };

        [
            'pointerdown',
            'mousedown',
            'pointerup',
            'mouseup',
            'click'
        ].forEach(type => {
            try {
                const EventClass =
                    type.startsWith(
                        'pointer'
                    )
                        ? PointerEvent
                        : MouseEvent;

                tab.dispatchEvent(
                    new EventClass(
                        type,
                        options
                    )
                );
            } catch {}
        });

        if (
            await waitForSalesPage(
                2500
            )
        ) {
            return true;
        }

        return false;
    }


    // =========================================================
    // 6. 结算总额
    // =========================================================

    function readSettlement() {
        const labels =
            [
                ...document.querySelectorAll(
                    '.data-overview-dashboard-items-item__label'
                )
            ];

        const label =
            labels.find(el =>
                el.textContent
                    ?.replace(/\s+/g, '')
                    .includes('结算总额')
            );

        if (!label) {
            return '';
        }

        const card =
            label.closest(
                '.data-overview-dashboard-items-item'
            );

        if (!card) {
            return '';
        }

        const valueEl =
            card.querySelector(
                '.data-overview-dashboard-items-item__value'
            );

        if (!valueEl) {
            return '';
        }

        let value =
            valueEl.textContent
                ?.replace(/\s+/g, '')
                .trim() || '';

        if (
            value.includes('达人未授权') ||
            value === '未授权'
        ) {
            return '未授权';
        }

        if (
            !value ||
            value === '-' ||
            value === '--' ||
            value.includes('加载')
        ) {
            return '';
        }

        value =
            value.replace(
                /[¥￥]/g,
                ''
            );

        if (!/\d/.test(value)) {
            return '';
        }

        return value;
    }


    async function getSettlement() {
        setStatus(
            '等待结算总额加载...'
        );

        for (
            let i = 0;
            i < 200;
            i++
        ) {
            const value =
                readSettlement();

            if (value) {
                console.log(
                    '[达人助手] 结算总额读取成功：',
                    value
                );

                setStatus(
                    '结算总额读取成功'
                );

                return value;
            }

            await sleep(100);
        }

        console.warn(
            '[达人助手] 等待20秒仍未读取到结算总额'
        );

        return '';
    }


    // =========================================================
    // 7. 完整采集
    // =========================================================

    async function collectCurrentDaren() {
        if (normalizedPath() !== '/dashboard/servicehall/daren-profile') {
            setStatus('请先进入达人详情页，再点击采集');
            showToast('请先点进一位达人的详情页后采集');
            return;
        }

        const button =
            document.querySelector(
                '#daren-helper-collect'
            );

        if (button) {
            button.disabled =
                true;

            button.innerText =
                '正在采集...';
        }

        try {
            setStatus(
                '读取达人基础信息...'
            );

            const name =
                getDarenName();

            const level =
                getLevel();

            const pageUrl =
                window.location.href;

            const douyinId =
                await getDouyinId();

            const opened =
                await openSalesAnalysis();

            if (!opened) {
                throw new Error(
                    '未能切换到带货分析'
                );
            }

            setStatus(
                '正在读取结算总额...'
            );

            const settlement =
                await getSettlement();

            currentResult = {
                name,
                douyinId,
                level,
                settlement,
                pageUrl
            };

            renderCurrentResult();

            const missing = [];

            if (!name) {
                missing.push(
                    '达人名称'
                );
            }

            if (!douyinId) {
                missing.push(
                    '抖音号'
                );
            }

            if (!level) {
                missing.push(
                    '达人等级'
                );
            }

            if (!settlement) {
                missing.push(
                    '结算总额'
                );
            }

            if (missing.length) {
                setStatus(
                    `未识别：${missing.join('、')}`
                );

                alert(
`采集未完成

未识别：
${missing.join('、')}

当前结果：

达人名称：${name || '未识别'}
抖音号：${douyinId || '未识别'}
达人等级：${level || '未识别'}
结算总额：${settlement || '未识别'}
主页链接：${pageUrl || '未识别'}`
                );

                return;
            }

            const record = {
                name,
                douyinId,
                level,
                settlement,
                pageUrl,
                time:
                    new Date()
                        .toLocaleString()
            };

            const records =
                getRecords();

            const index =
                records.findIndex(
                    item =>
                        item.douyinId ===
                        douyinId
                );

            let action = '';

            if (index >= 0) {
                records[index] =
                    record;

                action =
                    '已更新';
            } else {
                records.push(
                    record
                );

                action =
                    '已新增';
            }

            saveRecords(
                records
            );

            GM_setClipboard(
                [
                    name,
                    douyinId,
                    level,
                    settlement,
                    pageUrl
                ].join('\t')
            );

            setStatus(
                `${action}：${name}`
            );

            showToast(
                `${action} ${name}，当前共 ${records.length} 人`
            );

        } catch (error) {
            setStatus(
                '采集失败'
            );

            alert(
                '采集失败：' +
                error.message
            );

        } finally {
            if (button) {
                button.disabled =
                    false;

                button.innerText =
                    '采集当前达人';
            }
        }
    }


    // =========================================================
    // 8. 查看 / 删除
    // =========================================================

    function closeRecordsModal() {
        document.querySelector(
            '#daren-records-modal'
        )?.remove();
    }


    function deleteRecord(index) {
        const records =
            getRecords();

        const item =
            records[index];

        if (!item) {
            return;
        }

        if (
            !confirm(
                `确定删除？\n\n${item.name}\n${item.douyinId}`
            )
        ) {
            return;
        }

        records.splice(
            index,
            1
        );

        saveRecords(
            records
        );

        renderRecordsTable();
    }


    function renderRecordsTable() {
        const tbody =
            document.querySelector(
                '#daren-records-tbody'
            );

        if (!tbody) {
            return;
        }

        const records =
            getRecords();

        const count =
            document.querySelector(
                '#daren-records-modal-count'
            );

        if (count) {
            count.innerText =
                `共 ${records.length} 人`;
        }

        if (!records.length) {
            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        style="
                            padding:30px;
                            text-align:center;
                            color:#999;
                        "
                    >
                        暂无数据
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            records
                .map(
                    (r, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(r.name)}</td>
                            <td>${escapeHtml(r.douyinId)}</td>
                            <td>${escapeHtml(r.level)}</td>
                            <td>${escapeHtml(r.settlement)}</td>
                            <td>
                                ${
                                    r.pageUrl
                                        ? `<a href="${escapeHtml(r.pageUrl)}" target="_blank" rel="noopener noreferrer">打开主页</a>`
                                        : ''
                                }
                            </td>
                            <td>
                                <button
                                    class="daren-delete-btn"
                                    data-index="${index}"
                                >
                                    删除
                                </button>
                            </td>
                        </tr>
                    `
                )
                .join('');

        tbody
            .querySelectorAll(
                '.daren-delete-btn'
            )
            .forEach(btn => {
                btn.onclick =
                    () => {
                        deleteRecord(
                            Number(
                                btn.dataset.index
                            )
                        );
                    };
            });
    }


    function showRecordsModal() {
        closeRecordsModal();

        const overlay =
            document.createElement(
                'div'
            );

        overlay.id =
            'daren-records-modal';

        Object.assign(
            overlay.style,
            {
                position: 'fixed',
                inset: '0',
                zIndex: '2147483647',
                background: 'rgba(0,0,0,.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '30px'
            }
        );

        overlay.innerHTML = `
            <div style="
                width:min(1050px,95vw);
                max-height:85vh;
                background:#fff;
                border-radius:12px;
                overflow:hidden;
                display:flex;
                flex-direction:column;
                box-shadow:0 12px 40px rgba(0,0,0,.28);
            ">
                <div style="
                    padding:14px 18px;
                    border-bottom:1px solid #eee;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">
                    <div>
                        <div style="
                            font-size:17px;
                            font-weight:700;
                        ">
                            已采集达人
                        </div>

                        <div
                            id="daren-records-modal-count"
                            style="
                                margin-top:3px;
                                color:#888;
                                font-size:12px;
                            "
                        ></div>
                    </div>

                    <button
                        id="daren-records-close"
                        style="
                            border:0;
                            background:transparent;
                            font-size:25px;
                            cursor:pointer;
                        "
                    >
                        ×
                    </button>
                </div>

                <div style="
                    overflow:auto;
                    padding:0 16px 16px;
                ">
                    <table style="
                        width:100%;
                        border-collapse:collapse;
                        margin-top:14px;
                        font-size:13px;
                    ">
                        <thead>
                            <tr>
                                <th>序号</th>
                                <th>达人名称</th>
                                <th>抖音号</th>
                                <th>达人等级</th>
                                <th>结算总额</th>
                                <th>主页链接</th>
                                <th>操作</th>
                            </tr>
                        </thead>

                        <tbody
                            id="daren-records-tbody"
                        ></tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(
            overlay
        );

        const style =
            document.createElement(
                'style'
            );

        style.textContent = `
            #daren-records-modal th,
            #daren-records-modal td {
                padding:10px 12px;
                text-align:left;
                border-bottom:1px solid #eee;
                white-space:nowrap;
            }

            #daren-records-modal th {
                position:sticky;
                top:0;
                background:#fafafa;
                z-index:1;
            }

            #daren-records-modal tr:hover td {
                background:#fafafa;
            }

            .daren-delete-btn {
                padding:4px 10px;
                border:1px solid #ddd;
                border-radius:5px;
                background:#fff;
                cursor:pointer;
            }
        `;

        overlay.appendChild(
            style
        );

        document.querySelector(
            '#daren-records-close'
        ).onclick =
            closeRecordsModal;

        overlay.onclick =
            event => {
                if (
                    event.target ===
                    overlay
                ) {
                    closeRecordsModal();
                }
            };

        renderRecordsTable();
    }


    // =========================================================
    // 9. CSV
    // =========================================================

    function exportCSV() {
        const records =
            getRecords();

        if (!records.length) {
            alert(
                '当前没有采集数据'
            );

            return;
        }

        const rows = [
            [
                '达人名称',
                '抖音号',
                '达人等级',
                '结算总额',
                '主页链接'
            ],

            ...records.map(
                r => [
                    r.name,
                    r.douyinId,
                    r.level,
                    r.settlement,
                    r.pageUrl || ''
                ]
            )
        ];

        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                value =>
                                    `"${String(
                                        value ?? ''
                                    ).replace(
                                        /"/g,
                                        '""'
                                    )}"`
                            )
                            .join(',')
                )
                .join('\n');

        const blob =
            new Blob(
                [
                    '\ufeff' +
                    csv
                ],
                {
                    type:
                        'text/csv;charset=utf-8;'
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                'a'
            );

        a.href =
            url;

        a.download =
            `达人采集_${
                new Date()
                    .toISOString()
                    .slice(0, 10)
            }.csv`;

        a.click();

        URL.revokeObjectURL(
            url
        );
    }


    function clearRecords() {
        const records =
            getRecords();

        if (!records.length) {
            return;
        }

        if (
            !confirm(
                `确定清空全部 ${records.length} 条数据？`
            )
        ) {
            return;
        }

        saveRecords([]);

        if (
            document.querySelector(
                '#daren-records-modal'
            )
        ) {
            renderRecordsTable();
        }
    }


    // =========================================================
    // 10. UI
    // =========================================================

    function updateCount() {
        const el =
            document.querySelector(
                '#daren-helper-count'
            );

        if (el) {
            el.innerText =
                `已采集：${
                    getRecords().length
                } 人`;
        }
    }


    function createLauncher(initialPosition = null) {
        if (!document.body || !isDarenPage()) {
            return;
        }

        if (
            document.querySelector('#daren-helper-launcher') ||
            document.querySelector('#daren-helper-panel')
        ) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'daren-helper-launcher';
        button.textContent = '达人助手';

        Object.assign(button.style, {
            position: 'fixed',
            right: '18px',
            bottom: '18px',
            zIndex: '2147483647',
            padding: '9px 13px',
            border: '1px solid #bbb',
            borderRadius: '20px',
            background: '#fff',
            color: '#222',
            boxShadow: '0 3px 14px rgba(0,0,0,.20)',
            cursor: 'grab',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            userSelect: 'none'
        });

        document.body.appendChild(button);

        if (initialPosition) {
            applyPosition(
                button,
                initialPosition.left,
                initialPosition.top
            );
        } else {
            restorePosition(button, LAUNCHER_POSITION_KEY);
        }

        makeDraggable({
            element: button,
            handle: button,
            storageKey: LAUNCHER_POSITION_KEY,
            onClick: () => {
                const rect = button.getBoundingClientRect();
                isCollapsed = false;
                button.remove();
                createPanel({left: rect.left, top: rect.top});
            }
        });
    }


    function createPanel(
        initialPosition = null
    ) {
        if (!document.body || !isDarenPage()) {
            return;
        }

        if (
            document.querySelector(
                '#daren-helper-panel'
            )
        ) {
            return;
        }

        const panel =
            document.createElement(
                'div'
            );

        panel.id =
            'daren-helper-panel';

        panel.innerHTML = `
            <div
                id="daren-helper-drag-handle"
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:8px;
                    margin-bottom:8px;
                    cursor:grab;
                    user-select:none;
                "
            >
                <div style="
                    font-weight:700;
                    font-size:15px;
                ">
                    达人采集助手
                </div>

                <button id="daren-helper-collapse" type="button">
                    收起
                </button>

            </div>

            <div
                id="daren-helper-count"
                style="
                    margin-bottom:4px;
                    font-size:13px;
                "
            ></div>

            <div
                id="daren-helper-status"
                style="
                    color:#888;
                    font-size:12px;
                    min-height:18px;
                    margin-bottom:8px;
                "
            >
                等待采集
            </div>

            <button id="daren-helper-collect">
                采集当前达人
            </button>

            <button id="daren-helper-view">
                查看已采集数据
            </button>

            <button id="daren-helper-export">
                导出 CSV
            </button>

            <button id="daren-helper-clear">
                清空数据
            </button>

            <div style="
                margin-top:12px;
                padding-top:10px;
                border-top:1px solid #eee;
            ">
                <div style="
                    font-size:13px;
                    font-weight:700;
                    margin-bottom:5px;
                ">
                    当前提取结果
                </div>

                <div
                    id="daren-helper-current-result"
                    style="
                        font-size:12px;
                        line-height:1.45;
                    "
                >
                    <div style="color:#999;">
                        尚未提取
                    </div>
                </div>
            </div>
        `;

        Object.assign(
            panel.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: '2147483647',
                width: '245px',
                padding: '14px',
                boxSizing: 'border-box',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: '10px',
                boxShadow: '0 5px 24px rgba(0,0,0,.22)',
                color: '#222',
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif'
            }
        );

        document.body.appendChild(
            panel
        );

        if (initialPosition) {
            applyPosition(
                panel,
                initialPosition.left,
                initialPosition.top
            );
        } else {
            restorePosition(
                panel,
                PANEL_POSITION_KEY
            );
        }

        panel
            .querySelectorAll(
                'button'
            )
            .forEach(btn => {
                Object.assign(
                    btn.style,
                    {
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        marginTop: '6px',
                        padding: '7px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        background: '#fff',
                        color: '#222',
                        cursor: 'pointer'
                    }
                );
            });

        const collapseButton =
            panel.querySelector('#daren-helper-collapse');

        Object.assign(collapseButton.style, {
            width: 'auto',
            marginTop: '0',
            padding: '3px 7px',
            flexShrink: '0'
        });

        collapseButton.onclick = () => {
            const rect = panel.getBoundingClientRect();
            savePosition(PANEL_POSITION_KEY, rect.left, rect.top);
            isCollapsed = true;
            panel.remove();
            createLauncher({left: rect.left, top: rect.top});
        };

        const dragHandle =
            panel.querySelector(
                '#daren-helper-drag-handle'
            );

        makeDraggable({
            element: panel,
            handle: dragHandle,
            storageKey:
                PANEL_POSITION_KEY,
            ignoreSelector:
                'button'
        });


        panel.querySelector(
            '#daren-helper-collect'
        ).onclick =
            collectCurrentDaren;

        panel.querySelector(
            '#daren-helper-view'
        ).onclick =
            showRecordsModal;

        panel.querySelector(
            '#daren-helper-export'
        ).onclick =
            exportCSV;

        panel.querySelector(
            '#daren-helper-clear'
        ).onclick =
            clearRecords;

        updateCount();
        renderCurrentResult();
    }


    // =========================================================
    // 只在达人广场和达人详情页显示完整面板
    // =========================================================

    function normalizedPath() {
        return window.location.pathname.replace(/\/+$/, '') || '/';
    }

    function isDarenPage() {
        return (
            normalizedPath() === '/dashboard/servicehall/daren-square' ||
            normalizedPath() === '/dashboard/servicehall/daren-profile'
        );
    }

    function syncPanelVisibility() {
        if (!document.body) {
            return;
        }

        const panel =
            document.querySelector('#daren-helper-panel');
        const launcher =
            document.querySelector('#daren-helper-launcher');

        if (!isDarenPage()) {
            panel?.remove();
            launcher?.remove();
            document.querySelector('#daren-records-modal')?.remove();
            document.querySelector('#daren-helper-toast')?.remove();
            // 重新进入达人广场/详情页时默认展开
            isCollapsed = false;
            return;
        }

        if (isCollapsed) {
            panel?.remove();
            if (!launcher) {
                createLauncher();
            }
        } else {
            launcher?.remove();
            if (!panel) {
                createPanel();
            }
        }
    }

    window.addEventListener('resize', () => {
        const panel =
            document.querySelector('#daren-helper-panel');

        const launcher =
            document.querySelector('#daren-helper-launcher');
        const element = panel || launcher;
        if (!element) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const pos =
            applyPosition(
                element,
                rect.left,
                rect.top
            );

        savePosition(
            panel ? PANEL_POSITION_KEY : LAUNCHER_POSITION_KEY,
            pos.left,
            pos.top
        );
    });

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            syncPanelVisibility,
            { once: true }
        );
    } else {
        syncPanelVisibility();
    }

    // 抖店是单页应用：地址可能改变但脚本不重新执行。
    // 定期核对 pathname，切换到指定页面时自动展示，离开时移除。
    setInterval(syncPanelVisibility, 500);

})();
