#!/usr/bin/env python3
"""生成律衡用户手册 PDF；参数和字体配置与 npm run docs:pdf 相同。

示例：python scripts/generate_user_manual_pdf.py --date 2026-10-15
完整用法见 docs/development.md。
"""
from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("build-user-manual.py")), run_name="__main__")
