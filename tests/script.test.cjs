'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '..', 'douyin-creator-collector.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function fixture({ pathname = '/', settlementLabel, settlementValue, storage = {} } = {}) {
    const values = new Map(Object.entries(storage));
    const page = { pathname };

    const label = settlementLabel == null ? null : {
        textContent: settlementLabel,
        closest(selector) {
            assert.equal(selector, '.data-overview-dashboard-items-item');
            return {
                querySelector(valueSelector) {
                    assert.equal(valueSelector, '.data-overview-dashboard-items-item__value');
                    return settlementValue == null ? null : { textContent: settlementValue };
                }
            };
        }
    };

    const document = {
        readyState: 'loading',
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll(selector) {
            if (selector === '.data-overview-dashboard-items-item__label') {
                return label ? [label] : [];
            }
            return [];
        }
    };

    const sandbox = {
        document,
        window: {
            location: page,
            addEventListener() {},
            innerWidth: 1024,
            innerHeight: 768
        },
        localStorage: {
            getItem(key) { return values.has(key) ? values.get(key) : null; },
            setItem(key, value) { values.set(key, String(value)); },
            removeItem(key) { values.delete(key); }
        },
        console: { log() {}, warn() {}, error() {} },
        setInterval() {},
        setTimeout() {},
        confirm() { return true; }
    };

    const exportHooks = `\nglobalThis.__testHooks = { readSettlement, isDarenPage, getRecords, saveRecords, clearRecords };\n})();`;
    assert.match(source, /\}\)\(\);\s*$/);
    const testableSource = source.replace(/\}\)\(\);\s*$/, exportHooks);
    vm.runInNewContext(testableSource, sandbox, { filename: scriptPath, timeout: 2000 });
    return { api: sandbox.__testHooks, page, values };
}

test('supports creator square and creator profiles regardless of query parameters', () => {
    const { api, page } = fixture();
    page.pathname = '/dashboard/servicehall/daren-square';
    assert.equal(api.isDarenPage(), true);
    page.pathname = '/dashboard/servicehall/daren-profile';
    assert.equal(api.isDarenPage(), true);
    page.pathname = '/dashboard/servicehall/other-page';
    assert.equal(api.isDarenPage(), false);
});

test('extracts settlement range without currency symbols', () => {
    const { api } = fixture({ settlementLabel: '结算总额', settlementValue: '¥2,500 - ￥5,000' });
    assert.equal(api.readSettlement(), '2,500-5,000');
});

test('records unauthorized profiles as 未授权', () => {
    const { api } = fixture({ settlementLabel: '结算总额', settlementValue: '达人未授权' });
    assert.equal(api.readSettlement(), '未授权');
});

test('waits when settlement is not loaded', () => {
    assert.equal(fixture().api.readSettlement(), '');
    assert.equal(fixture({ settlementLabel: '结算总额', settlementValue: '--' }).api.readSettlement(), '');
});

test('migrates previous records only when current storage key is absent', () => {
    const old = [{ name: 'example', douyinId: 'demo' }];
    const { api, values } = fixture({ storage: { daren_collector_v6_final: JSON.stringify(old) } });
    assert.equal(api.getRecords().length, 1);
    assert.equal(JSON.parse(values.get('daren_collector_v7')).length, 1);
    api.saveRecords([]);
    assert.equal(api.getRecords().length, 0);
});

test('clearing saved records does not resurrect a previous version', () => {
    const old = [{ name: 'example', douyinId: 'demo' }];
    const { api, values } = fixture({
        storage: {
            daren_collector_v7: JSON.stringify(old),
            daren_collector_v6_final: JSON.stringify(old)
        }
    });
    api.clearRecords();
    assert.equal(api.getRecords().length, 0);
    assert.equal(values.get('daren_collector_v7'), '[]');
});
