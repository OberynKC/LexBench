#!/usr/bin/env python3
"""本地检查手册正文、图片、字体嵌入、书签、链接及元数据，并生成逐页验收图。

自动检查不能代替逐页视觉检查与目标阅读器验收。输出目录可用 --qa-dir 指定。
"""
from __future__ import annotations

import argparse
import ctypes
from contextlib import closing
import json
import re
import runpy
import sys
from pathlib import Path
from urllib.parse import urlsplit

import pypdfium2 as pdfium
import pypdfium2.raw as raw
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_MD = REPO_ROOT / 'docs' / 'user-manual.md'


# 中文行首禁排标点（仅全角，避免误报代码块中的半角符号）
LINE_START_FORBIDDEN = '，。、；：？！）》〉」』】〕”’'


def line_start_punctuation(page_text):
    """返回以禁排标点开头的文本行（前 20 字）。"""
    lines = (line.strip() for line in page_text.splitlines())
    return [line[:20] for line in lines if line and line[0] in LINE_START_FORBIDDEN]


def normalize(text):
    return re.sub(r'\s+', '', text)


def inline_text(tokens):
    return ''.join(t.get('raw', '') if 'children' not in t else inline_text(t['children'])
                   for t in tokens)


def source_items(tokens):
    """逐段核验，不把目录命中当作正文完整的证据。"""
    texts, headings, images = [], [], []
    for tok in tokens:
        kind = tok['type']
        if kind in ('heading', 'paragraph', 'block_text', 'table_cell'):
            children = tok['children']
            if kind == 'paragraph' and len(children) == 1 and children[0]['type'] == 'image':
                images.append(inline_text(children[0].get('children', [])))
            else:
                value = inline_text(children)
                texts.append(value)
                if kind == 'heading':
                    headings.append(value)
        elif kind == 'block_code':
            texts.extend(line for line in tok['raw'].splitlines() if line.strip())
        elif 'children' in tok:
            subtexts, subheads, subimages = source_items(tok['children'])
            texts.extend(subtexts)
            headings.extend(subheads)
            images.extend(subimages)
    return texts, headings, images


def check_links(doc, page, page_number, problems):
    position, link = ctypes.c_int(), raw.FPDF_LINK()
    count = 0
    while raw.FPDFLink_Enumerate(page, ctypes.byref(position), ctypes.byref(link)):
        count += 1
        dest = raw.FPDFLink_GetDest(doc, link)
        action = raw.FPDFLink_GetAction(link)
        if dest:
            index = raw.FPDFDest_GetDestPageIndex(doc, dest)
            if not 0 <= index < len(doc):
                problems.append(f'第 {page_number} 页内部链接目标无效')
        elif action and raw.FPDFAction_GetType(action) == raw.PDFACTION_URI:
            size = raw.FPDFAction_GetURIPath(doc, action, None, 0)
            buffer = ctypes.create_string_buffer(size)
            raw.FPDFAction_GetURIPath(doc, action, buffer, size)
            url = urlsplit(buffer.value.decode('utf-8'))
            if url.scheme not in ('https', 'http') or not url.netloc or url.username:
                problems.append(f'第 {page_number} 页外部链接类型不合规')
        else:
            problems.append(f'第 {page_number} 页含无效链接或文件动作')
    return count


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('pdf', nargs='?')
    ap.add_argument('--qa-dir', default=str(REPO_ROOT / 'release' / 'manual-qa'))
    args = ap.parse_args()
    version = json.loads((REPO_ROOT / 'package.json').read_text())['version']
    pdf_path = Path(args.pdf) if args.pdf else REPO_ROOT / 'release' / f'v{version}' / f'律衡用户手册-v{version}.pdf'
    qa_dir = Path(args.qa_dir)
    qa_dir.mkdir(parents=True, exist_ok=True)
    builder = runpy.run_path(str(REPO_ROOT / 'scripts' / 'build-user-manual.py'))
    texts, headings, images = source_items(builder['parse_body'](SOURCE_MD.read_text(encoding='utf-8')))
    problems, page_text, thumbs, low_content = [], [], [], []
    font_count = image_count = link_count = 0

    with pdfium.PdfDocument(str(pdf_path)) as doc:
        for i in range(len(doc)):
            with closing(doc[i]) as page:
                with closing(page.get_textpage()) as tp:
                    page_text.append(tp.get_text_range())
                    for line in line_start_punctuation(tp.get_text_bounded()):
                        problems.append(f'第 {i + 1} 页行首出现禁排标点: {line}')
                for obj in page.get_objects():
                    if obj.type == raw.FPDF_PAGEOBJ_TEXT:
                        font_count += 1
                        font = raw.FPDFTextObj_GetFont(obj)
                        if not font or raw.FPDFFont_GetIsEmbedded(font) != 1:
                            problems.append(f'第 {i + 1} 页有未嵌入字体')
                    elif obj.type == raw.FPDF_PAGEOBJ_IMAGE:
                        image_count += 1
                link_count += check_links(doc, page, i + 1, problems)
                bitmap = page.render(scale=1.5)
                img = bitmap.to_pil().copy()
                bitmap.close()
                img.save(qa_dir / f'page-{i + 1:02d}.png')
                hist = img.convert('L').histogram()
                if sum(hist[:245]) / (img.width * img.height) < 0.005:
                    low_content.append(i + 1)
                img.thumbnail((300, 425))
                thumbs.append(img)

        bookmarks = list(doc.get_toc())
        if [b.get_title() for b in bookmarks] != headings:
            problems.append('章节书签与 Markdown 标题不一致')
        destinations = []
        for bookmark in bookmarks:
            dest = bookmark.get_dest()
            index = dest.get_index() if dest else None
            if index is None or not 0 <= index < len(doc):
                problems.append(f'书签目标无效: {bookmark.get_title()}')
            else:
                destinations.append(index)
                if normalize(bookmark.get_title()) not in normalize(page_text[index]):
                    problems.append(f'书签指向页缺少对应标题: {bookmark.get_title()}')
        body = normalize('\n'.join(page_text[min(destinations):])) if destinations else ''
        for text in texts:
            if normalize(text) not in body:
                problems.append(f'正文未完整提取: {text[:70]}')
        for i, alt in enumerate(images, 1):
            if normalize(f'图 {i}：{alt}') not in body:
                problems.append(f'图 {i} 图注缺失')
        if image_count != len(images):
            problems.append(f'图片数量不符: PDF {image_count} / Markdown {len(images)}')
        if '\ufffd' in body or '□' in body:
            problems.append('文本层存在缺字标记')
        if not font_count or not link_count:
            problems.append('字体或链接检查没有找到对象')
        meta = doc.get_metadata_dict()
        if meta.get('Title') != f'律衡用户手册 v{version}' or meta.get('Author') != 'OberynKC':
            problems.append('标题或署名元数据不符')
        if re.search(r'/Users/|/home/|[A-Za-z]:\\|file:', json.dumps(meta, ensure_ascii=False)):
            problems.append('元数据含本机路径')
        page_count = len(doc)

    cols, tw, th = 4, 300, 425
    sheet = Image.new('RGB', (cols * tw, ((len(thumbs) + cols - 1) // cols) * th), 'white')
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((i % cols) * tw, (i // cols) * th))
    sheet.save(qa_dir / 'contact-sheet.png')
    result = dict(pages=page_count, sourceTextBlocks=len(texts), images=image_count,
                  fontObjects=font_count, links=link_count, lowContentPages=low_content,
                  problems=problems, manualVisualReview='待逐页检查及阅读器验收')
    (qa_dir / 'check-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f'逐页图与总览：{qa_dir}')
    print('自动检查通过；请另行完成逐页视觉和阅读器验收。' if not problems else '检查未通过。')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
