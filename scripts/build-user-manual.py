#!/usr/bin/env python3
"""从 docs/user-manual.md 生成用户手册 PDF（唯一正文来源是该 Markdown）。

用法：
    python scripts/build-user-manual.py --date 2026-10-13 \
        [--font-regular PATH] [--font-bold PATH] [--out PATH]

中文字体：使用 SIL OFL 许可的 Noto Sans SC 静态 TTF。通过命令行参数或环境变量
LEXBENCH_DOCS_FONT_REGULAR / LEXBENCH_DOCS_FONT_BOLD 指定；字体准备步骤见
docs/development.md。字体不随仓库分发。

输出默认 release/v<版本>/律衡用户手册-v<版本>.pdf，版本读取 package.json。
PDF 元数据只含公开产品名与署名，不写入本机路径或用户名。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date as Date
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit, quote

import mistune
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Image,
    PageBreak, Table, TableStyle, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import paragraph as rl_paragraph
from reportlab.lib.textsplit import ALL_CANNOT_START, ALL_CANNOT_END
from reportlab.rl_config import _FUZZ

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_MD = REPO_ROOT / 'docs' / 'user-manual.md'
PUBLIC_BASE = 'https://github.com/OberynKC/LexBench/blob/main/'

INK = HexColor('#333333')
NAVY = HexColor('#1e3a5f')
GRAY = HexColor('#666666')
LIGHT = HexColor('#f5f5f5')


def slugify(text: str) -> str:
    """标题转锚点 key：保留中英文与数字，去掉其余字符。"""
    return re.sub(r'[^0-9A-Za-z一-鿿]+', '', text)


def parse_body(md_text: str):
    """手工目录只用于 Markdown；严格核验结构后由 PDF 自动目录替代。"""
    tokens = mistune.create_markdown(renderer=None, plugins=['table'])(md_text)
    body = []
    in_toc = False
    title_seen = False
    for tok in tokens:
        if tok['type'] == 'blank_line':
            continue
        if in_toc:
            if tok['type'] != 'list':
                raise ValueError('手工目录标题后必须紧接目录列表')
            for item in tok['children']:
                children = item['children']
                if (len(children) != 1 or children[0]['type'] != 'block_text'
                        or len(children[0]['children']) != 1
                        or children[0]['children'][0]['type'] != 'link'
                        or not children[0]['children'][0]['attrs']['url'].startswith('#')):
                    raise ValueError('手工目录只能包含内部章节链接')
            in_toc = False
            continue
        if tok['type'] == 'heading':
            level = tok['attrs']['level']
            raw = ''.join(c.get('raw', '') for c in tok['children'])
            if level == 1:
                if title_seen or raw != '律衡（LexBench）用户手册':
                    raise ValueError('手册须有且仅有一个产品大标题')
                title_seen = True
                continue
            if level not in (2, 3):
                raise ValueError('手册只支持二、三级章节标题')
            if level == 2 and raw == '目录':
                in_toc = True
                continue
        body.append(tok)
    if in_toc or not title_seen:
        raise ValueError('手册标题或目录不完整')
    return body


# 锚点注册表：Markdown slug → ASCII key（ReportLab 对非 ASCII 锚点编码后无法匹配）
_ANCHORS: dict[str, str] = {}


def anchor_key(slug: str) -> str:
    if slug not in _ANCHORS:
        _ANCHORS[slug] = f'sec-{len(_ANCHORS) + 1}'
    return _ANCHORS[slug]


def collect_anchors(md_text: str) -> None:
    """预先登记全部标题锚点，供正文内 # 链接解析。"""
    _ANCHORS.clear()
    for tok in parse_body(md_text):
        if tok['type'] == 'heading':
            raw = ''.join(c.get('raw', '') for c in tok['children'])
            slug = slugify(raw)
            if slug in _ANCHORS:
                raise ValueError(f'重复标题锚点: {raw}')
            anchor_key(slug)


def convert_href(href: str) -> str:
    """相对链接转公开网址；锚点与 http(s) 链接保留。禁止 file/绝对路径。"""
    if href.startswith('#'):
        slug = slugify(unquote(href[1:]))  # mistune 会对锚点做百分号编码
        if slug not in _ANCHORS:
            raise ValueError(f'未定义的锚点链接: {href}')
        return '#' + _ANCHORS[slug]
    url = urlsplit(href)
    if url.scheme in ('http', 'https') and url.netloc and not url.username:
        return href
    if url.scheme or url.netloc or href.startswith('/') or '\\' in href:
        raise ValueError(f'不允许的链接: {href}')
    p = (REPO_ROOT / 'docs' / unquote(url.path)).resolve()
    rel = p.relative_to(REPO_ROOT).as_posix()
    if not p.is_file():
        raise ValueError(f'链接目标不存在: {href}')
    return urlunsplit(('https', 'github.com', '/OberynKC/LexBench/blob/main/' + quote(rel),
                      url.query, url.fragment))


class ManualDoc(BaseDocTemplate):
    def __init__(self, filename: str, **kw):
        super().__init__(
            filename, pagesize=A4,
            topMargin=2.2 * cm, bottomMargin=2.0 * cm,
            leftMargin=2.4 * cm, rightMargin=2.4 * cm,
            title=kw.pop('title'), author=kw.pop('author'),
            subject=kw.pop('subject'), creator='build-user-manual.py',
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='main')
        self.addPageTemplates([PageTemplate(id='page', frames=[frame], onPage=self._header_footer)])

    def _header_footer(self, canv, doc):
        canv.saveState()
        w, h = A4
        canv.setFont('NotoSC', 8)
        canv.setFillColor(GRAY)
        if doc.page > 1:
            canv.drawString(doc.leftMargin, h - 1.4 * cm, '律衡用户手册')
            canv.drawRightString(w - doc.rightMargin, h - 1.4 * cm, f'版本 {doc._version}')
            canv.setStrokeColor(HexColor('#dddddd'))
            canv.line(doc.leftMargin, h - 1.6 * cm, w - doc.rightMargin, h - 1.6 * cm)
        canv.drawCentredString(w / 2, 1.2 * cm, f'{doc.page}')
        canv.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and getattr(flowable, '_toc_level', None) is not None:
            level = flowable._toc_level
            text = flowable.getPlainText()
            key = flowable._bookmark_key
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
            self.notify('TOCEntry', (level, text, self.page, key))


# 中文禁则：ReportLab 自带表缺少全角逗号、分号、冒号、问号、叹号等，
# 且遇到连续收尾标点（如「）。」）只悬挂一个字符，导致标点落到行首。
CANNOT_START = ALL_CANNOT_START + '，；：？！）》〉」』】〕”’…·％'
CANNOT_END = ALL_CANNOT_END + '（《〈「『【〔“‘'


def _is_latin(ch: str) -> bool:
    return bool(ch) and ord(ch) < 0x3000 and not ch.isspace()


def _break_index(U, start: int, i: int) -> int:
    """U[i] 放不下时确定本行结束位置（本行为 U[start:k]）。

先避免拆开英文单词，再把不可行首的标点连同前一个字一起移到下一行，
并避免左括号、左引号留在行尾。无法满足时退回按宽度硬断。"""
    k = i
    if _is_latin(U[i]) and _is_latin(U[i - 1]):
        for j in range(i - 1, (start + i) // 2, -1):
            if not _is_latin(U[j]):
                k = j + 1
                break
    # 空字符串片段永远属于任何字符串，需排除
    while k > start + 1 and ((U[k] and U[k] in CANNOT_START) or (U[k - 1] and U[k - 1] in CANNOT_END)):
        k -= 1
    return k if k > start else i


def cjk_frag_split(frags, maxWidths, calcBounds, encoding='utf8'):
    """替代 reportlab.platypus.paragraph.cjkFragSplit，输出结构与原函数一致。"""
    U = []
    for f in frags:
        text = f.text.decode(encoding) if isinstance(f.text, bytes) else f.text
        if text:
            U.extend(rl_paragraph.cjkU(t, f, encoding) for t in text)
        else:  # 空片段可能携带内部锚点等定义，保持原函数行为
            U.append(rl_paragraph.cjkU(text, f, encoding))

    def width(u, max_width):
        w = u.width
        if hasattr(w, 'normalizedValue'):
            w._normalizer = max_width
            w = w.normalizedValue(max_width)
        return w

    lines = []
    start = i = 0
    used = 0.0
    max_width = maxWidths[0]

    def end_line(k, line_break):
        nonlocal start, used, max_width
        line_used = sum(width(u, max_width) for u in U[start:k])
        lines.append(rl_paragraph.makeCJKParaLine(
            U[start:k], max_width, line_used, max_width - line_used, line_break, calcBounds))
        max_width = maxWidths[min(len(lines), len(maxWidths) - 1)]
        start, used = k, 0.0

    while i < len(U):
        u = U[i]
        if hasattr(u.frag, 'lineBreak'):
            i += 1
            end_line(i, True)
            continue
        w = width(u, max_width)
        if used + w > max_width + _FUZZ and i > start:
            k = _break_index(U, start, i)
            end_line(k, False)
            i = k
            continue
        used += w
        i += 1
    if start < len(U):
        end_line(len(U), False)
    return rl_paragraph.ParaLines(kind=1, lines=lines)


def cjk_word_split(word, maxWidths, fontName, fontSize, encoding='utf8'):
    """替代单片段段落使用的 reportlab.lib.textsplit.wordSplit，返回 [剩余宽度, 行文本]。"""
    if isinstance(word, bytes):
        word = word.decode(encoding)
    if not isinstance(maxWidths, (list, tuple)):
        maxWidths = [maxWidths]
    widths = [pdfmetrics.stringWidth(c, fontName, fontSize) for c in word]
    lines = []
    start = i = 0
    used = 0.0
    while i < len(word):
        max_width = maxWidths[min(len(lines), len(maxWidths) - 1)]
        if used + widths[i] > max_width + _FUZZ and i > start:
            k = _break_index(word, start, i)
            lines.append([max_width - sum(widths[start:k]), word[start:k].strip()])
            start, i, used = k, k, 0.0
            continue
        used += widths[i]
        i += 1
    if start < len(word):
        max_width = maxWidths[min(len(lines), len(maxWidths) - 1)]
        lines.append([max_width - used, word[start:]])
    return lines


rl_paragraph.cjkFragSplit = cjk_frag_split
rl_paragraph.wordSplit = cjk_word_split


def make_styles():
    base = dict(fontName='NotoSC', bulletFontName='NotoSC', textColor=INK,
                leading=16, fontSize=10.5, wordWrap='CJK')
    return {
        'title': ParagraphStyle('title', fontName='NotoSC-Bold', fontSize=24, leading=32,
                                textColor=NAVY, alignment=1, spaceAfter=14),
        'subtitle': ParagraphStyle('subtitle', fontName='NotoSC', fontSize=11, leading=18,
                                   textColor=GRAY, alignment=1, spaceAfter=6),
        'h1': ParagraphStyle('h1', fontName='NotoSC-Bold', fontSize=16, leading=22,
                             textColor=NAVY, spaceBefore=18, spaceAfter=8, keepWithNext=1),
        'h2': ParagraphStyle('h2', fontName='NotoSC-Bold', fontSize=13, leading=19,
                             textColor=NAVY, spaceBefore=12, spaceAfter=6, keepWithNext=1),
        'h3': ParagraphStyle('h3', fontName='NotoSC-Bold', fontSize=11.5, leading=17,
                             textColor=INK, spaceBefore=9, spaceAfter=4, keepWithNext=1),
        'body': ParagraphStyle('body', spaceAfter=5, **base),
        'bullet': ParagraphStyle('bullet', leftIndent=16, bulletIndent=4, spaceAfter=3, **base),
        'number': ParagraphStyle('number', leftIndent=16, bulletIndent=4, spaceAfter=3, **base),
        'quote': ParagraphStyle('quote', leftIndent=10, borderColor=HexColor('#d0d7de'),
                                borderWidth=0, borderLeftWidth=3, borderPadding=6,
                                backColor=LIGHT, textColor=GRAY, spaceBefore=6, spaceAfter=6,
                                fontName='NotoSC', fontSize=10, leading=15),
        'code': ParagraphStyle('code', fontName='NotoSC', fontSize=9.5, leading=13,
                               backColor=LIGHT, leftIndent=6, rightIndent=6,
                               borderPadding=4, spaceBefore=4, spaceAfter=4),
        'caption': ParagraphStyle('caption', fontName='NotoSC', fontSize=8.5, leading=12,
                                  textColor=GRAY, alignment=1, spaceBefore=3, spaceAfter=10),
        'toc1': ParagraphStyle('toc1', fontName='NotoSC', fontSize=10.5, leading=18,
                               textColor=INK, leftIndent=0),
        'toc2': ParagraphStyle('toc2', fontName='NotoSC', fontSize=9.5, leading=16,
                               textColor=GRAY, leftIndent=14),
    }


def render_inline(tokens) -> str:
    """行内 Markdown 记号 → ReportLab 段落标记；不支持的结构报错。"""

    def render_one(t) -> str:
        kind = t['type']
        if kind == 'text':
            return _esc_text(t['raw'])
        if kind == 'strong':
            return '<b>%s</b>' % ''.join(render_one(c) for c in t['children'])
        if kind == 'emphasis':
            return '<i>%s</i>' % ''.join(render_one(c) for c in t['children'])
        if kind == 'codespan':
            return '<font backColor="#f5f5f5">%s</font>' % _esc_text(t['raw'])
        if kind == 'link':
            href = convert_href(t['attrs']['url'])
            label = ''.join(render_one(c) for c in t.get('children', [])) or _esc(href)
            return '<a href="%s" color="#1e3a5f">%s</a>' % (_esc_attr(href), label)
        if kind == 'image':
            raise ValueError('图片必须独占一个段落，不能放在正文行内')
        if kind in ('softbreak', 'linebreak'):
            return '<br/>'
        raise ValueError(f'不支持的行内结构: {kind}')

    return ''.join(render_one(tok) for tok in tokens)


def _esc(s: str) -> str:
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _esc_text(s: str) -> str:
    """正文转义；⌘ 等 Noto Sans SC 不包含的符号切换到符号字体。"""
    return _esc(s).replace('⌘', '<font name="NotoSym">⌘</font>')


def _esc_attr(s: str) -> str:
    return s.replace('&', '&amp;').replace('"', '&quot;')


def build_story(md_text: str, styles, version: str, date: str):
    tokens = parse_body(md_text)
    story = []

    # 封面
    story.append(Spacer(1, 6 * cm))
    story.append(Paragraph('律衡（LexBench）用户手册', styles['title']))
    story.append(Paragraph(f'版本 {version}（Pre-release 测试版）', styles['subtitle']))
    story.append(Paragraph(f'发布日期 {date}', styles['subtitle']))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph('GPL-3.0-only © OberynKC', styles['subtitle']))
    story.append(PageBreak())

    list_stack = []
    img_count = 0

    def flush_list():
        nonlocal list_stack
        list_stack = []

    for tok in tokens:
        t = tok['type']
        if t == 'heading':
            flush_list()
            level = tok['attrs']['level']
            raw = ''.join(c.get('raw', '') for c in tok['children'])
            text = render_inline(tok['children'])
            key = anchor_key(slugify(raw))
            p = Paragraph(f'<a name="{_esc_attr(key)}"/>{text}', styles[f'h{level - 1}'])
            p._toc_level = level - 2
            p._bookmark_key = key
            story.append(p)
        elif t == 'paragraph':
            children = tok['children']
            if len(children) == 1 and children[0]['type'] == 'image':
                flush_list()
                img = children[0]
                src = img['attrs']['url']
                alt = ''.join(c.get('raw', '') for c in img.get('children', []))
                path = (REPO_ROOT / 'docs' / src).resolve()
                if not path.is_relative_to(REPO_ROOT / 'docs') or not path.is_file():
                    raise ValueError(f'图片不存在或越界: {src}')
                from PIL import Image as PILImage
                with PILImage.open(path) as im:
                    w_px, h_px = im.size
                max_w = A4[0] - 4.8 * cm - 12  # 扣除 Frame 左右内边距
                w = max_w
                h = w * h_px / w_px
                max_h = 19 * cm
                if h > max_h:
                    h = max_h
                    w = h * w_px / h_px
                img_count += 1
                # 与紧邻标题一起跨页，避免标题停留在上一页末尾。
                group = [Image(str(path), width=w, height=h),
                         Paragraph(f'图 {img_count}：{_esc_text(alt)}', styles['caption'])]
                while story and getattr(story[-1], '_toc_level', None) is not None:
                    group.insert(0, story.pop())
                story.append(KeepTogether(group))
            else:
                text = render_inline(children)
                style = styles['quote'] if list_stack == ['quote'] else styles['body']
                if list_stack == ['quote']:
                    flush_list()
                story.append(Paragraph(text, style))
        elif t == 'block_quote':
            flush_list()
            for sub in tok['children']:
                if sub['type'] != 'paragraph':
                    raise ValueError(f'引用块内不支持的结构: {sub["type"]}')
                story.append(Paragraph(render_inline(sub['children']), styles['quote']))
        elif t == 'list':
            ordered = tok['attrs'].get('ordered', False)
            for i, item in enumerate(tok['children'], tok['attrs'].get('start', 1)):
                for sub in item['children']:
                    if sub['type'] not in ('paragraph', 'block_text'):
                        raise ValueError(f'列表项内不支持的结构: {sub["type"]}')
                    marker = f'{i}.' if ordered else '•'
                    story.append(Paragraph(
                        f'<bullet>{marker}</bullet>{render_inline(sub["children"])}',
                        styles['number'] if ordered else styles['bullet']))
        elif t == 'block_code':
            flush_list()
            story.append(Paragraph(_esc_text(tok['raw']).replace('\n', '<br/>'), styles['code']))
        elif t == 'table':
            flush_list()
            head = tok['children'][0]
            body_rows = tok['children'][1]['children'] if len(tok['children']) > 1 else []
            data = [[Paragraph(render_inline(c['children']), styles['body'])
                     for c in head['children']]]
            for row in body_rows:
                data.append([Paragraph(render_inline(c['children']), styles['body'])
                             for c in row['children']])
            tbl = Table(data, colWidths=[(A4[0] - 4.8 * cm - 12) / len(data[0])] * len(data[0]),
                        repeatRows=1)
            tbl.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'NotoSC'),
                ('LINEABOVE', (0, 0), (-1, 0), 1.2, INK),
                ('LINEBELOW', (0, 0), (-1, 0), 0.6, INK),
                ('LINEBELOW', (0, -1), (-1, -1), 1.2, INK),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(tbl)
            story.append(Spacer(1, 6))
        elif t == 'thematic_break':
            flush_list()
            story.append(Spacer(1, 10))
        elif t == 'blank_line':
            pass
        else:
            raise ValueError(f'不支持的块级结构: {t}')
    return story, img_count


def main() -> int:
    ap = argparse.ArgumentParser(description='生成律衡用户手册 PDF')
    ap.add_argument('--date', required=True, help='发布日期 YYYY-MM-DD（显式指定，不取构建时间）')
    ap.add_argument('--font-regular', default=os.environ.get('LEXBENCH_DOCS_FONT_REGULAR'))
    ap.add_argument('--font-bold', default=os.environ.get('LEXBENCH_DOCS_FONT_BOLD'))
    ap.add_argument('--font-symbols', default=os.environ.get('LEXBENCH_DOCS_FONT_SYMBOLS'),
                    help='Noto Sans Symbols 2（⌘ 等符号字形）')
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    try:
        Date.fromisoformat(args.date)
    except ValueError:
        ap.error('--date 必须是有效的 YYYY-MM-DD 日期')

    for name, p in (('正文字体', args.font_regular), ('粗体字体', args.font_bold),
                    ('符号字体', args.font_symbols)):
        if not p or not Path(p).exists():
            print(f'缺少{name}：请用 --font-* 或 LEXBENCH_DOCS_FONT_* 指定 Noto Sans SC 静态 TTF', file=sys.stderr)
            return 2

    version = json.loads((REPO_ROOT / 'package.json').read_text())['version']
    out = Path(args.out) if args.out else REPO_ROOT / 'release' / f'v{version}' / f'律衡用户手册-v{version}.pdf'
    out.parent.mkdir(parents=True, exist_ok=True)

    pdfmetrics.registerFont(TTFont('NotoSC', args.font_regular))
    pdfmetrics.registerFont(TTFont('NotoSC-Bold', args.font_bold))
    pdfmetrics.registerFont(TTFont('NotoSym', args.font_symbols))
    pdfmetrics.registerFontFamily('NotoSC', normal='NotoSC', bold='NotoSC-Bold',
                                  italic='NotoSC', boldItalic='NotoSC-Bold')

    md = SOURCE_MD.read_text(encoding='utf-8')
    # 文字提取能返回字符并不证明字体含有字形；构建时核验实际字体映射。
    from fontTools.ttLib import TTFont as FontInfo
    chars = {ord(c) for c in md + '律衡目录版本发布日期测试版图©•' if not c.isspace() and c != '⌘'}
    for path in (args.font_regular, args.font_bold):
        with FontInfo(path) as font:
            missing = chars - font.getBestCmap().keys()
        if missing:
            raise ValueError('字体缺少字形: ' + ''.join(chr(c) for c in sorted(missing)))
    with FontInfo(args.font_symbols) as font:
        if ord('⌘') not in font.getBestCmap():
            raise ValueError('符号字体缺少 ⌘ 字形')
    collect_anchors(md)
    styles = make_styles()
    story, img_count = build_story(md, styles, version, args.date)

    # 目录页：封面（以第一个 PageBreak 结束）之后、正文之前
    toc = TableOfContents()
    toc.levelStyles = [styles['toc1'], styles['toc2']]
    cover_end = next(i for i, f in enumerate(story) if isinstance(f, PageBreak))
    cover, body = story[:cover_end + 1], story[cover_end + 1:]
    story = cover + [Paragraph('目录', ParagraphStyle('toctitle', parent=styles['h1'], spaceBefore=0)),
                     toc, PageBreak()] + body

    doc = ManualDoc(str(out), title=f'律衡用户手册 v{version}',
                    author='OberynKC', subject=f'律衡（LexBench）{version} 用户手册')
    doc._version = version
    doc.multiBuild(story)
    print(f'PDF 已生成: {out}（图片 {img_count} 张）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
