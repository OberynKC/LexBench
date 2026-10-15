# 律衡（LexBench）

律衡是面向中国执业律师的个人工作台，以「案件」为轴心组织客户、合同、收费、发票、待办、日程、保全执行与办案笔记。全部数据保存在本机 SQLite 数据库与本地附件目录，不联网、不上传。

**当前版本：0.3.0（Pre-release 测试版），用于小范围试用和反馈。请使用虚构资料测试，妥善备份已有数据。**

## 主要功能

- 客户 / 案件 / 合同三层结构，案件阶段模板与关联案件
- 合同收费期次、发票登记与收费进度统计
- 待办与日程联动、保全期限预警、提醒中心与系统通知
- 办案笔记（Markdown、草稿自动保存、历史版本与恢复副本）
- 全局搜索（Cmd/Ctrl+K，七类实体分组与定位跳转）
- Excel 导出、附件 ZIP、完整备份与恢复（预检 + 自动恢复点）
- 明暗主题

![律衡仪表盘](docs/images/user-manual/02-dashboard.png)

## 下载与安装

见 [Releases 下载页面](https://github.com/OberynKC/LexBench/releases/tag/v0.3.0)、[版本说明](docs/releases/v0.3.0.md)与 [安装升级说明](docs/installation.md)。目标平台：macOS 13+（Apple Silicon）、Windows 10/11 64 位（**未完成实机验收**）。最低系统来自运行时要求，未逐版本实测。测试包未购买商业签名：macOS 为 ad-hoc 签名未公证，Windows 未签名，安装时的系统拦截与应对见安装说明。

## 数据与隐私

数据只存在您的电脑上，数据库与附件未做应用层加密，请启用系统全盘加密。详见 [数据与隐私说明](docs/data-and-privacy.md)。

## 用户手册

- Markdown：[docs/user-manual.md](docs/user-manual.md)
- PDF：见 Releases 附件「律衡用户手册-v0.3.0.pdf」

## 开发与贡献

- [开发说明](docs/development.md)（Node.js 22.23.3，Electron 44，Electron + React + Vite + TypeScript + better-sqlite3）
- [参与贡献](CONTRIBUTING.md) · [安全政策](SECURITY.md) · [更新日志](CHANGELOG.md)
- 第三方组件声明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## 许可

[GPL-3.0-only](LICENSE) © OberynKC
