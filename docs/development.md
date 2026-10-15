# 开发说明

## 环境

- Node.js 22.23.3（见 .nvmrc），npm 10.9+
- macOS（Xcode 命令行工具）或 Windows（Python + C++ 构建工具，用于原生模块编译）

## 开始

```bash
npm run setup   # 安装依赖、下载 Electron、重建 better-sqlite3（首次或重装依赖后）
npm run dev     # 开发模式（Vite + Electron）
```

`ELECTRON_SKIP_BINARY_DOWNLOAD=1` 可跳过 Electron 下载，此时用 `npx vite` 做浏览器预览（无数据功能）。

## 测试与构建

```bash
npm run build          # 类型检查 + 前端构建 + 主进程打包
npm run smoke:db       # 数据库
npm run smoke:backup   # 备份恢复
npm run smoke:export   # 导出
npm run smoke:ipc      # IPC 与并发保护
npm run smoke:search   # 全局搜索
npm run smoke:content  # 虚构数据 / 阶段模板 / 农历
npm run dist:mac       # 仅 Apple Silicon Mac：打包 + 包内检查 + 校验
npm run dist:win       # 仅 Windows x64
```

冒烟测试只使用内存或系统临时目录中的虚构数据，不访问真实数据目录。

## 第三方声明

`node scripts/generate-notices.cjs > THIRD_PARTY_NOTICES.md` 重新生成依赖声明；发布时随附同内容的 `THIRD_PARTY_NOTICES.txt`。

## 用户手册 PDF

手册唯一正文来源是 `docs/user-manual.md`（Markdown），PDF 由脚本从该文件生成，不另维护排版稿。`scripts/generate_user_manual_pdf.py` 与 `scripts/build-user-manual.py` 共用生成实现及命令行参数。

先创建环境并安装固定依赖（本轮使用 Python 3.14.3）：

```bash
python3 -m venv .venv-docs
source .venv-docs/bin/activate
python -m pip install -r requirements-docs.txt
```

Windows PowerShell 对应使用 `py -3 -m venv .venv-docs`、`.\\.venv-docs\\Scripts\\Activate.ps1`。

字体准备（一次性，字体不随仓库分发；许可允许嵌入 PDF）：

从 [google/fonts 固定提交](https://github.com/google/fonts/tree/66928797f271fed5ee428544e7229685e2d90127/ofl) 下载以下文件至仓库外的字体目录，同时保存两份 SIL OFL 1.1 许可：

| 仓库内路径 | 本地文件名 | SHA-256 |
| --- | --- | --- |
| `notosanssc/NotoSansSC[wght].ttf` | `NotoSansSC-VF.ttf` | `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da` |
| `notosanssc/OFL.txt` | `OFL.txt` | `1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9` |
| `notosanssymbols2/NotoSansSymbols2-Regular.ttf` | 同左侧文件名 | `7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21` |
| `notosanssymbols2/OFL.txt` | `OFL-Symbols2.txt` | `b118dd41337806a5d4797052c77caf3bd096aed783e5eb21b4d11154351e1ac0` |

在字体目录执行下面的 Python 代码；Windows 可保存为临时 `.py` 文件运行：

```bash
# 使用刚才虚拟环境的 Python 实例化静态字重：
python - <<'EOF'
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
for wght, name in [(400, 'NotoSansSC-Regular.ttf'), (700, 'NotoSansSC-Bold.ttf')]:
    font = TTFont('NotoSansSC-VF.ttf')
    instantiateVariableFont(font, {'wght': wght}, inplace=True)
    font.save(name)
EOF
```

回到项目目录，字体文件路径通过环境变量传入：

```bash
export LEXBENCH_DOCS_FONT_REGULAR=/path/to/NotoSansSC-Regular.ttf
export LEXBENCH_DOCS_FONT_BOLD=/path/to/NotoSansSC-Bold.ttf
export LEXBENCH_DOCS_FONT_SYMBOLS=/path/to/NotoSansSymbols2-Regular.ttf
npm run docs:pdf -- --date 2026-10-13   # 发布日期需显式传入
python scripts/test-user-manual.py       # 解析器回归测试
npm run docs:check -- --qa-dir ../manual-qa # 全文、字体、书签、链接、图片及元数据检查
```

Windows 使用 `$env:LEXBENCH_DOCS_FONT_REGULAR='C:\\字体目录\\NotoSansSC-Regular.ttf'` 等方式设置三项变量；也可直接执行 `python scripts/build-user-manual.py --date YYYY-MM-DD --font-regular ... --font-bold ... --font-symbols ...`。发布日期为显式参数，示例日期不代表实际发布日。

输出为 `release/v<版本>/律衡用户手册-v<版本>.pdf`。正式验收图用 `--qa-dir` 存放于仓库外；省略时默认写入已忽略的 `release/manual-qa/`。每次检查使用独立验收目录，避免将旧页图误认为本次结果。正文、图片或脚本修改后必须重新生成并检查。自动检查不能替代逐页视觉、macOS Preview 和跨平台阅读器验收。

## GitHub 工作流

- `ci.yml`：PR 与手动运行，macOS / Windows 编译及六组冒烟，不打包、不发布。
- `package.yml`：仅主分支手动触发，完成六组冒烟、打包及包内检查，只上传指定候选安装包、校验和与构建信息；不会创建 Release。
- 权限仅 `contents: read`，checkout 不保留凭据；Actions 固定提交 SHA。安装使用锁文件、跳过依赖安装脚本，单独准备 Electron 和 SQLite；工作流不引用签名或发布 Secrets。

## 架构要点

核心约定：数据全部本地 SQLite；主进程经参数化 SQL 访问；渲染进程经 contextBridge IPC；写操作经 FIFO 队列与导出保护；附件物理存于 userData/attachments。
