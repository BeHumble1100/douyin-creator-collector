// ==UserScript==
// @name         抖店达人采集助手 V4.5
// @namespace    douyin-daren-helper
// @version      4.5
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

    const STORAGE_KEY = 'daren_collector_v4_1';

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    // 当前页面最近一次提取结果
    let currentResult = null;


    // =========================================================
    // 通用
    // =========================================================

    function isVisible(el) {

        if (!el) return false;

        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }


    function getRecords() {

        try {

            return JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            ) || [];

        } catch {

            return [];
        }
    }


    function saveRecords(records) {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(records)
        );

        updatePanel();
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


    function renderCurrentResult(result = currentResult) {

        const box =
            document.querySelector(
                '#daren-helper-current-result'
            );

        if (!box) {
            return;
        }

        if (!result) {

            box.innerHTML = `
                <div style="color:#999;">
                    尚未提取当前达人
                </div>
            `;

            return;
        }

        const row = (label, value) => `
            <div style="
                display:grid;
                grid-template-columns:66px 1fr;
                gap:6px;
                margin-top:4px;
                align-items:start;
            ">
                <div style="color:#888;">
                    ${escapeHtml(label)}
                </div>
                <div style="
                    color:#222;
                    word-break:break-all;
                ">
                    ${escapeHtml(value || '未识别')}
                </div>
            </div>
        `;

        box.innerHTML = `
            ${row('达人名称', result.name)}
            ${row('抖音号', result.douyinId)}
            ${row('达人等级', result.level)}
            ${row('结算总额', result.settlement)}
        `;
    }


    function getPageLines() {

        return (document.body.innerText || '')
            .split('\n')
            .map(x => x.trim())
            .filter(Boolean);
    }


    function escapeHtml(value) {

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    function showToast(message, duration = 2200) {

        let toast =
            document.querySelector(
                '#daren-helper-toast'
            );

        if (!toast) {

            toast =
                document.createElement('div');

            toast.id =
                'daren-helper-toast';

            Object.assign(
                toast.style,
                {
                    position: 'fixed',
                    right: '22px',
                    bottom: '245px',
                    zIndex: '100000001',
                    background: 'rgba(30,30,30,.92)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxShadow: '0 4px 14px rgba(0,0,0,.22)',
                    maxWidth: '320px'
                }
            );

            document.body.appendChild(toast);
        }

        toast.innerText = message;
        toast.style.display = 'block';

        clearTimeout(toast._hideTimer);

        toast._hideTimer =
            setTimeout(() => {
                toast.style.display = 'none';
            }, duration);
    }


    // =========================================================
    // 1. 达人等级
    //
    // 已通过真实 DOM 确认：
    // <img data-author-level="1">
    // =========================================================

    function getLevel() {

        const el =
            document.querySelector(
                'img[data-author-level]'
            );

        if (!el) {

            console.warn(
                '[达人助手] 未找到等级节点'
            );

            return '';
        }

        const level =
            el.getAttribute(
                'data-author-level'
            );

        if (!level) {
            return '';
        }

        const result =
            `LV${level}`;

        console.log(
            '[达人助手] 等级：',
            result
        );

        return result;
    }


    // =========================================================
    // 2. 达人名称
    //
    // 根据“粉丝”信息附近定位达人名称
    // =========================================================

    function getDarenName() {

        const lines =
            getPageLines();

        const followerIndex =
            lines.findIndex(line =>
                line.includes('粉丝') &&
                /\d/.test(line)
            );

        if (
            followerIndex === -1
        ) {

            console.warn(
                '[达人助手] 未找到粉丝信息'
            );

            return '';
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

            '履约分'
        ];

        for (
            let i = followerIndex - 1;
            i >= Math.max(
                0,
                followerIndex - 8
            );
            i--
        ) {

            let candidate =
                lines[i]
                    .replace(
                        /\bLV\s*\d+\b/ig,
                        ''
                    )
                    .trim();

            if (!candidate) {
                continue;
            }

            if (
                blacklist.includes(
                    candidate
                )
            ) {
                continue;
            }

            if (
                candidate.includes(
                    '粉丝'
                )
            ) {
                continue;
            }

            if (
                /^[\d,.%¥￥\-]+$/
                    .test(candidate)
            ) {
                continue;
            }

            if (
                candidate.length > 40
            ) {
                continue;
            }

            console.log(
                '[达人助手] 达人名称：',
                candidate
            );

            return candidate;
        }

        return '';
    }


    // =========================================================
    // 3. 精确读取抖音号
    //
    // 已确认真实 DOM：
    // .qrcode-content-info-account
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
            el.innerText?.trim() || '';

        const match =
            text.match(
                /抖音号\s*[：:]\s*(.+)/
            );

        if (!match) {
            return '';
        }

        const id =
            match[1].trim();

        console.log(
            '[达人助手] 抖音号：',
            id
        );

        return id;
    }


    // =========================================================
    // 4. 自动尝试打开二维码 Popover
    //
    // 已确认真实按钮：
    // .dp__icon-qrcode
    // =========================================================

    function triggerQRHover(qr) {

        if (!qr) return;

        const r =
            qr.getBoundingClientRect();

        const x =
            r.left +
            r.width / 2;

        const y =
            r.top +
            r.height / 2;

        const options = {

            bubbles: true,
            cancelable: true,
            composed: true,

            view: window,

            clientX: x,
            clientY: y
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

        if (qr.parentElement) {

            try {

                qr.parentElement
                    .dispatchEvent(
                        new MouseEvent(
                            'mouseover',
                            options
                        )
                    );

            } catch {}
        }
    }


    // =========================================================
    // 尝试直接调用 React 节点事件
    // =========================================================

    function tryReactHover(qr) {

        let node = qr;

        for (
            let depth = 0;
            depth < 5 && node;
            depth++
        ) {

            const keys =
                Object.keys(node);

            const reactKey =
                keys.find(key =>
                    key.startsWith(
                        '__reactProps$'
                    )
                );

            if (reactKey) {

                const props =
                    node[reactKey];

                const handlers = [

                    'onMouseEnter',
                    'onMouseOver',

                    'onPointerEnter',
                    'onPointerOver'
                ];

                for (
                    const handler
                    of handlers
                ) {

                    if (
                        typeof props?.[
                            handler
                        ] === 'function'
                    ) {

                        try {

                            props[handler]({
                                currentTarget: node,
                                target: node,
                                type: handler
                            });

                        } catch {}
                    }
                }
            }

            node =
                node.parentElement;
        }
    }


    // =========================================================
    // 获取抖音号
    //
    // 自动 Hover失败时：
    // 等待用户把鼠标移到二维码上
    // =========================================================

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

            console.warn(
                '[达人助手] 未找到二维码'
            );

            return '';
        }

        setStatus(
            '正在自动读取抖音号...'
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
            '请把鼠标移到二维码图标上'
        );

        showToast(
            '自动 Hover 未成功，请把鼠标移到二维码图标上'
        );

        for (
            let i = 0;
            i < 150;
            i++
        ) {

            await sleep(100);

            id =
                readDouyinId();

            if (id) {

                setStatus(
                    '抖音号读取成功'
                );

                return id;
            }
        }

        return '';
    }


    // =========================================================
    // 5. V1 已验证成功：
    // 自动点击“带货分析”
    // =========================================================

    function getLeafElements() {

        return [
            ...document.querySelectorAll(
                'body *'
            )
        ]
            .filter(el => {

                if (
                    !isVisible(el)
                ) {
                    return false;
                }

                const text =
                    el.innerText?.trim();

                if (!text) {
                    return false;
                }

                return ![
                    ...el.children
                ].some(child =>
                    isVisible(child) &&
                    child.innerText
                        ?.trim() === text
                );
            });
    }


    async function openSalesAnalysis() {

        const tab =
            getLeafElements()
                .find(el =>
                    el.innerText
                        ?.trim() ===
                        '带货分析'
                );

        if (!tab) {

            console.warn(
                '[达人助手] 找不到带货分析'
            );

            return false;
        }

        const clickable =
            tab.closest(
                'button, a, [role="tab"]'
            ) || tab;

        clickable.click();

        console.log(
            '[达人助手] 点击带货分析'
        );

        for (
            let i = 0;
            i < 60;
            i++
        ) {

            await sleep(100);

            if (
                document.body.innerText
                    .includes(
                        '结算总额'
                    )
            ) {

                return true;
            }
        }

        return false;
    }


    // =========================================================
    // 6. V1 已验证成功：
    // 结算总额
    // =========================================================

    function getSettlement() {

        const label =
            getLeafElements()
                .find(el =>
                    el.innerText
                        ?.trim()
                        .includes(
                            '结算总额'
                        )
                );

        if (!label) {
            return '';
        }

        let current =
            label;

        for (
            let i = 0;
            i < 6;
            i++
        ) {

            if (!current) {
                break;
            }

            const text =
                current.innerText
                    ?.trim();

            if (text) {

                const match =
                    text.match(
                        /结算总额[\s\S]{0,100}?([¥￥]\s*[\d,.]+(?:\s*[-~～–—]\s*[¥￥]?\s*[\d,.]+)?)/i
                    );

                if (match) {

                    const value =
                        match[1]
                            .replace(
                                /\s+/g,
                                ''
                            );

                    console.log(
                        '[达人助手] 结算总额：',
                        value
                    );

                    return value;
                }
            }

            current =
                current.parentElement;
        }

        const bodyMatch =
            document.body
                .innerText
                .match(
                    /结算总额[\s\S]{0,100}?([¥￥]\s*[\d,.]+(?:\s*[-~～–—]\s*[¥￥]?\s*[\d,.]+)?)/i
                );

        return bodyMatch
            ? bodyMatch[1]
                .replace(
                    /\s+/g,
                    ''
                )
            : '';
    }


    // =========================================================
    // 7. 完整采集流程
    // =========================================================

    async function collectCurrentDaren() {

        const btn =
            document.querySelector(
                '#daren-helper-collect'
            );

        if (btn) {

            btn.disabled = true;

            btn.innerText =
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

            setStatus(
                '正在进入带货分析...'
            );

            const opened =
                await openSalesAnalysis();

            if (!opened) {

                throw new Error(
                    '未能打开带货分析'
                );
            }

            await sleep(500);

            setStatus(
                '正在读取结算总额...'
            );

            const settlement =
                getSettlement();

            const missing = [];

            if (!name)
                missing.push(
                    '达人名称'
                );

            if (!douyinId)
                missing.push(
                    '抖音号'
                );

            if (!level)
                missing.push(
                    '达人等级'
                );

            if (!settlement)
                missing.push(
                    '结算总额'
                );

            if (
                missing.length
            ) {

                currentResult = {
                    name,
                    douyinId,
                    level,
                    settlement
                };

                renderCurrentResult();

                setStatus(
                    '部分字段未识别'
                );

                alert(
`采集未完成：

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
                    x =>
                        x.douyinId ===
                        douyinId
                );

            let actionText = '';

            if (
                index >= 0
            ) {

                records[
                    index
                ] = record;

                actionText = '已更新';

            } else {

                records.push(
                    record
                );

                actionText = '已新增';
            }

            currentResult = record;
            renderCurrentResult();

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
                `${actionText}：${name}`
            );

            showToast(
                `${actionText} ${name}，当前共 ${records.length} 人`
            );

        } catch (
            error
        ) {

            console.error(
                '[达人助手]',
                error
            );

            setStatus(
                '采集失败'
            );

            alert(
                '采集失败：' +
                error.message
            );

        } finally {

            if (btn) {

                btn.disabled = false;

                btn.innerText =
                    '采集当前达人';
            }
        }
    }


    // =========================================================
    // 8. 查看已采集数据
    // =========================================================

    function closeRecordsModal() {

        const modal =
            document.querySelector(
                '#daren-records-modal'
            );

        if (modal) {
            modal.remove();
        }
    }


    function deleteRecord(index) {

        const records =
            getRecords();

        const record =
            records[index];

        if (!record) {
            return;
        }

        const ok =
            confirm(
                `确定删除这条记录吗？\n\n${record.name}\n${record.douyinId}`
            );

        if (!ok) {
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

        showToast(
            `已删除 ${record.name}`
        );
    }


    function renderRecordsTable() {

        const tbody =
            document.querySelector(
                '#daren-records-tbody'
            );

        const count =
            document.querySelector(
                '#daren-records-modal-count'
            );

        if (!tbody) {
            return;
        }

        const records =
            getRecords();

        if (count) {

            count.innerText =
                `共 ${records.length} 人`;
        }

        if (
            records.length === 0
        ) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        style="
                            padding:24px;
                            text-align:center;
                            color:#999;
                        "
                    >
                        暂无已采集数据
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

                            <td title="${escapeHtml(r.name)}">
                                ${escapeHtml(r.name)}
                            </td>

                            <td>
                                ${escapeHtml(r.douyinId)}
                            </td>

                            <td>
                                ${escapeHtml(r.level)}
                            </td>

                            <td>
                                ${escapeHtml(r.settlement)}
                            </td>

                            <td>
                                <button
                                    class="daren-delete-row"
                                    data-index="${index}"
                                    style="
                                        padding:4px 10px;
                                        border:1px solid #ddd;
                                        border-radius:5px;
                                        background:#fff;
                                        cursor:pointer;
                                    "
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
                '.daren-delete-row'
            )
            .forEach(btn => {

                btn.onclick = () => {

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
                zIndex: '100000000',
                background: 'rgba(0,0,0,.42)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '30px'
            }
        );

        overlay.innerHTML = `

<div
    style="
        width:min(1050px, 95vw);
        max-height:85vh;
        background:#fff;
        border-radius:12px;
        box-shadow:0 12px 40px rgba(0,0,0,.28);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        font-family:Arial, sans-serif;
    "
>
    <div
        style="
            padding:14px 18px;
            border-bottom:1px solid #eee;
            display:flex;
            align-items:center;
            justify-content:space-between;
        "
    >
        <div>
            <div
                style="
                    font-size:17px;
                    font-weight:700;
                "
            >
                已采集达人
            </div>

            <div
                id="daren-records-modal-count"
                style="
                    margin-top:3px;
                    font-size:12px;
                    color:#888;
                "
            ></div>
        </div>

        <button
            id="daren-records-close"
            style="
                border:none;
                background:transparent;
                font-size:24px;
                cursor:pointer;
                line-height:1;
            "
            title="关闭"
        >
            ×
        </button>
    </div>

    <div
        style="
            overflow:auto;
            padding:0 16px 16px;
        "
    >
        <table
            style="
                width:100%;
                border-collapse:collapse;
                margin-top:14px;
                font-size:13px;
            "
        >
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
                padding: 10px 12px;
                border-bottom: 1px solid #eee;
                text-align: left;
                white-space: nowrap;
            }

            #daren-records-modal th {
                position: sticky;
                top: 0;
                background: #fafafa;
                z-index: 1;
                font-weight: 600;
            }

            #daren-records-modal tr:hover td {
                background: #fafafa;
            }
        `;

        overlay.appendChild(
            style
        );

        document.querySelector(
            '#daren-records-close'
        ).onclick =
            closeRecordsModal;

        overlay.addEventListener(
            'click',
            event => {

                if (
                    event.target === overlay
                ) {
                    closeRecordsModal();
                }
            }
        );

        renderRecordsTable();
    }


    // =========================================================
    // 9. 导出 CSV
    // =========================================================

    function exportCSV() {

        const records =
            getRecords();

        if (!records.length) {

            alert(
                '还没有采集数据'
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
                .map(row =>
                    row.map(
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
                    .slice(0,10)
            }.csv`;

        a.click();

        URL.revokeObjectURL(
            url
        );

        showToast(
            `已导出 ${records.length} 条达人数据`
        );
    }


    // =========================================================
    // 10. 清空全部
    // =========================================================

    function clearRecords() {

        const records =
            getRecords();

        if (!records.length) {

            showToast(
                '当前没有数据'
            );

            return;
        }

        if (
            !confirm(
                `确定清空全部 ${records.length} 条达人数据吗？`
            )
        ) {
            return;
        }

        localStorage.removeItem(
            STORAGE_KEY
        );

        updatePanel();

        if (
            document.querySelector(
                '#daren-records-modal'
            )
        ) {
            renderRecordsTable();
        }

        setStatus(
            '已清空'
        );

        showToast(
            '全部采集数据已清空'
        );
    }


    // =========================================================
    // 11. UI
    // =========================================================

    function updatePanel() {

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


    function createPanel() {

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

<div style="
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin-bottom:7px;
">
    <div style="
        font-weight:700;
        font-size:15px;
    ">
        达人采集助手 V4.5
    </div>

    <button
        id="daren-helper-collapse"
        title="收起"
        style="
            width:auto;
            padding:2px 7px;
            margin:0;
            border:1px solid #ddd;
            border-radius:5px;
            background:#fff;
            cursor:pointer;
            font-size:12px;
        "
    >
        收起
    </button>
</div>

<div
    id="daren-helper-count"
    style="margin-bottom:4px;"
></div>

<div
    id="daren-helper-status"
    style="
        font-size:12px;
        color:#888;
        margin-bottom:8px;
        min-height:18px;
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
            尚未提取当前达人
        </div>
    </div>
</div>
`;

        Object.assign(
            panel.style,
            {
                position:
                    'fixed',

                right:
                    '20px',

                bottom:
                    '20px',

                zIndex:
                    '2147483647',

                width:
                    '230px',

                padding:
                    '14px',

                background:
                    '#fff',

                border:
                    '1px solid #ddd',

                borderRadius:
                    '10px',

                boxShadow:
                    '0 4px 20px rgba(0,0,0,.18)',

                fontSize:
                    '14px',

                fontFamily:
                    'Arial, sans-serif'
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
                        display:
                            'block',

                        width:
                            '100%',

                        marginTop:
                            '6px',

                        padding:
                            '7px',

                        cursor:
                            'pointer',

                        border:
                            '1px solid #ddd',

                        borderRadius:
                            '6px',

                        background:
                            '#fff'
                    }
                );
            });

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
        ).onclick = () => {

            panel.remove();

            createLauncher();
        };

        updatePanel();
        renderCurrentResult();
    }


    // =========================================================
    // 12. 仅在达人详情页显示面板
    //
    // 使用已确认的真实 DOM 特征判断：
    // .dp__icon-qrcode
    // img[data-author-level]
    //
    // 抖店是 SPA，因此还要监听页面 DOM 变化。
    // =========================================================

    // =========================================================
    // 12. V4.4 启动逻辑
    //
    // 不再判断是不是达人详情页。
    // 原则：可用性优先，只要脚本成功注入，就必须有入口。
    // =========================================================

    function createLauncher() {

        if (
            document.querySelector(
                '#daren-helper-launcher'
            ) ||
            document.querySelector(
                '#daren-helper-panel'
            )
        ) {
            return;
        }

        const launcher =
            document.createElement(
                'button'
            );

        launcher.id =
            'daren-helper-launcher';

        launcher.innerText =
            '达人助手';

        Object.assign(
            launcher.style,
            {
                position: 'fixed',
                right: '18px',
                bottom: '18px',
                zIndex: '2147483647',
                padding: '8px 12px',
                border: '1px solid #bbb',
                borderRadius: '18px',
                background: '#fff',
                boxShadow: '0 3px 14px rgba(0,0,0,.18)',
                fontSize: '12px',
                cursor: 'pointer'
            }
        );

        launcher.onclick = () => {

            launcher.remove();

            createPanel();
        };

        document.body.appendChild(
            launcher
        );
    }


    function safeInit() {

        if (!document.body) {

            setTimeout(
                safeInit,
                200
            );

            return;
        }

        document.documentElement.setAttribute(
            'data-daren-helper-loaded',
            '4.5'
        );

        console.log(
            '[达人助手] V4.5 已加载：',
            location.href
        );

        /*
         * 默认直接显示完整面板。
         * 不做任何页面类型判断。
         */
        if (
            !document.querySelector(
                '#daren-helper-panel'
            ) &&
            !document.querySelector(
                '#daren-helper-launcher'
            )
        ) {
            createPanel();
        }
    }


    // document-idle 下通常 body 已存在；
    // 这里再做一次保险。
    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            safeInit,
            {
                once: true
            }
        );

    } else {

        safeInit();
    }


    /*
     * 低频自愈：
     * 如果站点重渲染误删了面板/按钮，
     * 2 秒内自动恢复一个入口。
     */
    setInterval(
        () => {

            if (!document.body) {
                return;
            }

            const hasPanel =
                !!document.querySelector(
                    '#daren-helper-panel'
                );

            const hasLauncher =
                !!document.querySelector(
                    '#daren-helper-launcher'
                );

            if (
                !hasPanel &&
                !hasLauncher
            ) {
                createLauncher();
            }
        },
        2000
    );



    // 前 10 秒额外高频自愈，避免页面初始重渲染把面板吃掉。
    let bootRetryCount = 0;

    const bootRetryTimer =
        setInterval(
            () => {

                bootRetryCount++;

                if (document.body) {

                    const hasPanel =
                        !!document.querySelector(
                            '#daren-helper-panel'
                        );

                    const hasLauncher =
                        !!document.querySelector(
                            '#daren-helper-launcher'
                        );

                    if (
                        !hasPanel &&
                        !hasLauncher
                    ) {
                        createPanel();
                    }
                }

                if (bootRetryCount >= 20) {
                    clearInterval(
                        bootRetryTimer
                    );
                }
            },
            500
        );

})();
