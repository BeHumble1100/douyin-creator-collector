// ==UserScript==
// @name         抖店达人采集助手 V6 Final
// @namespace    douyin-daren-helper
// @version      6.1
// @description  批量采集达人名称、抖音号、达人等级、结算总额，并支持查看/删除/导出
// @match        *://buyin.jinritemai.com/*
// @match        *://*.jinritemai.com/*
// @include      *://buyin.jinritemai.com/*
// @include      *://*.jinritemai.com/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('[达人助手 V6 Final] 脚本开始执行');

    const STORAGE_KEY = 'daren_collector_v6_final';
    const OLD_STORAGE_KEYS = [
        'daren_collector_v6',
        'daren_collector_v5',
        'daren_collector_v4_1',
        'daren_collector_v4'
    ];

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    let currentResult = null;


    // =========================================================
    // 数据
    // =========================================================

    function getRecords() {
        try {
            const current =
                JSON.parse(
                    localStorage.getItem(STORAGE_KEY)
                ) || [];

            if (current.length) {
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
            value
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
                    ${escapeHtml(
                        value || '未识别'
                    )}
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
            console.log(
                '[达人助手] 结算总额标签尚未出现'
            );

            return '';
        }

        const card =
            label.closest(
                '.data-overview-dashboard-items-item'
            );

        if (!card) {
            console.log(
                '[达人助手] 找到标签，但找不到结算总额卡片'
            );

            return '';
        }

        const valueEl =
            card.querySelector(
                '.data-overview-dashboard-items-item__value'
            );

        if (!valueEl) {
            console.log(
                '[达人助手] 结算金额节点尚未出现'
            );

            return '';
        }

        const value =
            valueEl.textContent
                ?.replace(/\s+/g, '')
                .trim() || '';

        console.log(
            '[达人助手] 原始结算金额：',
            value
        );

        if (
            !value ||
            value === '-' ||
            value === '--' ||
            value.includes('加载')
        ) {
            return '';
        }

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
                settlement
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
结算总额：${settlement || '未识别'}`
                );

                return;
            }

            const record = {
                name,
                douyinId,
                level,
                settlement,
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
                    settlement
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
                        colspan="6"
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
                '结算总额'
            ],

            ...records.map(
                r => [
                    r.name,
                    r.douyinId,
                    r.level,
                    r.settlement
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

        localStorage.removeItem(
            STORAGE_KEY
        );

        updateCount();

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


    function createLauncher() {
        if (
            !document.body ||
            document.querySelector(
                '#daren-helper-launcher'
            ) ||
            document.querySelector(
                '#daren-helper-panel'
            )
        ) {
            return;
        }

        const button =
            document.createElement(
                'button'
            );

        button.id =
            'daren-helper-launcher';

        button.innerText =
            '达人助手';

        Object.assign(
            button.style,
            {
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
                cursor: 'pointer',
                fontSize: '13px'
            }
        );

        button.onclick =
            () => {
                button.remove();
                createPanel();
            };

        document.body.appendChild(
            button
        );
    }


    function createPanel() {
        if (!document.body) {
            return;
        }

        if (
            document.querySelector(
                '#daren-helper-panel'
            )
        ) {
            return;
        }

        document.querySelector(
            '#daren-helper-launcher'
        )?.remove();

        const panel =
            document.createElement(
                'div'
            );

        panel.id =
            'daren-helper-panel';

        panel.innerHTML = `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:8px;
                margin-bottom:8px;
            ">
                <div style="
                    font-weight:700;
                    font-size:15px;
                ">
                    达人采集助手 V6 Final
                </div>

                <button
                    id="daren-helper-collapse"
                    style="
                        width:auto;
                        margin:0;
                        padding:3px 7px;
                    "
                >
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

        Object.assign(
            document.querySelector(
                '#daren-helper-collapse'
            ).style,
            {
                width: 'auto',
                marginTop: '0'
            }
        );

        document.querySelector(
            '#daren-helper-collect'
        ).onclick =
            collectCurrentDaren;

        document.querySelector(
            '#daren-helper-view'
        ).onclick =
            showRecordsModal;

        document.querySelector(
            '#daren-helper-export'
        ).onclick =
            exportCSV;

        document.querySelector(
            '#daren-helper-clear'
        ).onclick =
            clearRecords;

        document.querySelector(
            '#daren-helper-collapse'
        ).onclick =
            () => {
                panel.remove();
                createLauncher();
            };

        updateCount();
        renderCurrentResult();
    }


    // =========================================================
    // 启动
    // =========================================================

    function init() {
        if (!document.body) {
            setTimeout(
                init,
                200
            );

            return;
        }

        createPanel();
    }


    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            init,
            {
                once: true
            }
        );
    } else {
        init();
    }


    setInterval(
        () => {
            if (!document.body) {
                return;
            }

            const panel =
                document.querySelector(
                    '#daren-helper-panel'
                );

            const launcher =
                document.querySelector(
                    '#daren-helper-launcher'
                );

            if (
                !panel &&
                !launcher
            ) {
                createLauncher();
            }
        },
        1500
    );

})();
