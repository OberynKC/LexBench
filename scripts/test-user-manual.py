#!/usr/bin/env python3
"""手册解析与链接转换回归测试：python scripts/test-user-manual.py。"""
import runpy
import unittest
from pathlib import Path

BUILDER = runpy.run_path(str(Path(__file__).with_name('build-user-manual.py')))
TITLE = '# 律衡（LexBench）用户手册\n\n'


class ManualTests(unittest.TestCase):
    def test_table_is_parsed(self):
        tokens = BUILDER['parse_body'](TITLE + '| 标题 | 内容 |\n| --- | --- |\n| 甲 | 乙 |')
        self.assertEqual(tokens[0]['type'], 'table')

    def test_manual_toc_replaced(self):
        tokens = BUILDER['parse_body'](TITLE + '## 目录\n\n1. [第一章](#第一章)\n\n## 第一章\n\n正文')
        self.assertEqual([t['type'] for t in tokens], ['heading', 'paragraph'])

    def test_toc_does_not_swallow_body(self):
        for body in ['## 目录\n\n正文', '## 目录\n\n1. 普通列表', '## 目录']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                BUILDER['parse_body'](TITLE + body)

    def test_invalid_headings_fail(self):
        for body in [TITLE + '# 第二个大标题', TITLE + '#### 太深', '## 缺少大标题']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                BUILDER['parse_body'](body)

    def test_duplicate_anchor_fails(self):
        with self.assertRaises(ValueError):
            BUILDER['collect_anchors'](TITLE + '## 一、简介\n\n## 一简介')

    def test_anchor_decoding(self):
        BUILDER['collect_anchors'](TITLE + '## 一、简介')
        self.assertTrue(BUILDER['convert_href']('#%E4%B8%80%E7%AE%80%E4%BB%8B').startswith('#sec-'))
        with self.assertRaises(ValueError):
            BUILDER['convert_href']('#不存在')

    def test_relative_link_preserves_fragment(self):
        self.assertEqual(BUILDER['convert_href']('installation.md#安装'),
                         'https://github.com/OberynKC/LexBench/blob/main/docs/installation.md#安装')

    def test_unsafe_links_fail(self):
        for href in ['file:///tmp/manual.pdf', '/tmp/manual.pdf', 'C:\\private',
                     'javascript:alert(1)', '//example.com', '../../outside.md', 'missing.md']:
            with self.subTest(href=href), self.assertRaises(ValueError):
                BUILDER['convert_href'](href)

    def test_inline_image_and_unknown_tokens_fail(self):
        for kind in ['image', 'inline_html', 'unsupported']:
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                BUILDER['render_inline']([{'type': kind, 'raw': '内容'}])

    def test_break_avoids_line_start_punctuation(self):
        """标点放不下时把前一个字一起移到下一行，连续收尾标点不拆开。"""
        brk = BUILDER['_break_index']
        self.assertEqual(brk(list('甲乙丙，丁'), 0, 3), 2)
        self.assertEqual(brk(list('甲乙丙）。丁'), 0, 4), 2)
        self.assertEqual(brk(list('甲乙丙「丁'), 0, 4), 3)
        self.assertEqual(brk(list('甲乙丙丁'), 0, 3), 3)
        self.assertEqual(brk(list('，，，'), 0, 1), 1)

    def test_break_keeps_latin_word(self):
        self.assertEqual(BUILDER['_break_index'](list('中文中文中文Markdown'), 0, 8), 6)


if __name__ == '__main__':
    unittest.main()
