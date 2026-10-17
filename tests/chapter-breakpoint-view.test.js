import test from 'node:test';
import assert from 'node:assert/strict';
import {breakpointMarkup} from '../src/chapter-breakpoint-view.js';

const pin = offset => `<span class="breakpoint-pin" data-pin="${offset}"></span>`;

test('没有断点时只做转义，不产生高亮节点', () => {
  assert.equal(breakpointMarkup('第一行\n<script>alert(1)</script>', []), '第一行\n&lt;script&gt;alert(1)&lt;/script&gt;&#8203;');
  assert.equal(breakpointMarkup('正文', []).includes('has-breakpoint'), false);
});

test('只给包含断点的行套底色，并保留精确偏移', () => {
  const html = breakpointMarkup('甲乙丙\n丁戊', [2]);
  const [first, second] = html.split('\n');
  assert.match(first, /^<span class="breakpoint-line has-breakpoint">甲乙/);
  assert.ok(first.includes(pin(2)));
  assert.equal(first.includes('丙'), true, '断点后的字符仍要保留');
  assert.equal(second.includes('has-breakpoint'), false);
});

test('同一行的多个断点按位置排序，行尾断点仍属于本行', () => {
  const html = breakpointMarkup('甲乙丙丁', [3, 1, 2]);
  const pins = [...html.matchAll(/data-pin="(\d+)"/g)].map(match => Number(match[1]));
  assert.deepEqual(pins, [1, 2, 3]);
  assert.equal((html.match(/has-breakpoint/g) || []).length, 1);
  assert.equal(breakpointMarkup('甲乙\n丙丁', [2]).includes('has-breakpoint'), true);
});

test('重复与无序断点被去重，不会生成重复竖线', () => {
  const html = breakpointMarkup('甲乙\n丙丁', [2, 2, 0]);
  assert.equal((html.match(/data-pin/g) || []).length, 2);
  assert.equal(html.startsWith('<span class="breakpoint-line has-breakpoint">'), true);
});

test('代理对与特殊字符原样保留，不截断字符', () => {
  const body = '他笑了👩‍🚀，然后离开。';
  const html = breakpointMarkup(body, [body.indexOf('，')]);
  assert.ok(html.includes('👩‍🚀'));
  assert.ok(html.includes('&#8203;'));
  // 去掉标记后文本应与原文完全一致（不含末尾零宽空格实体）。
  const restored = html.replace(/<[^>]+>/g, '').replace('&#8203;', '');
  assert.equal(restored, body);
});

test('正文中的标签与引号不会被当成 HTML', () => {
  const body = '<img onerror=alert(1)>\n"引号" & \'单引\'';
  const html = breakpointMarkup(body, [2]);
  assert.equal(html.includes('<img'), false);
  assert.ok(html.includes('&lt;'));
  assert.ok(html.includes('&quot;引号&quot;'));
  assert.ok(html.includes('&#39;单引&#39;'));
  // 除自己生成的 span 之外，正文里不应残留任何可执行的标签。
  assert.equal((html.match(/<(?!\/?span\b)/g) || []).length, 0);
});
