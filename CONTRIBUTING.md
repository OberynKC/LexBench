# 参与贡献

## 开发环境

见 [docs/development.md](docs/development.md)。Node.js 版本以 .nvmrc 为准。

## 基本要求

- 修改后通过 npm run build 及全部冒烟测试（smoke:db / smoke:backup / smoke:export / smoke:ipc / smoke:search / smoke:content）。
- 数据库结构变更只新增 migration；UI 文案使用简体中文；不引入新的组件库。
- 提交信息简要说明动机与行为变化。
- 不要提交真实案件数据、个人身份信息或任何凭据。

## 许可

贡献的代码按本仓库 GPL-3.0-only 许可发布。提交即表示您有权授权该贡献。

## 反馈

缺陷与一般建议使用 GitHub Issues（请按模板脱敏）；安全问题见 [SECURITY.md](SECURITY.md)。
