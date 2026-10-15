/** 从锁文件生成第三方声明：node scripts/generate-notices.cjs > THIRD_PARTY_NOTICES.md */
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
const pkg = require('../package.json')
const direct = new Set(Object.keys(pkg.dependencies))
const rows = []
for (const [loc, info] of Object.entries(lock.packages)) {
  if (!loc || info.dev) continue
  const dir = path.join(root, loc)
  const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  let text = ''
  for (const f of fs.readdirSync(dir)) {
    if (/^(licen[cs]e|notice)/i.test(f)) { text = fs.readFileSync(path.join(dir, f), 'utf8').trim(); break }
  }
  rows.push({ name: p.name, version: p.version, license: p.license ?? '未声明', direct: direct.has(p.name), text })
}
rows.sort((a, b) => a.name.localeCompare(b.name))
const lines = [
  '# 第三方组件声明',
  '',
  `本文件列示律衡（LexBench）${pkg.version} 生产安装包包含的全部运行时依赖及其许可。由 scripts/generate-notices.cjs 依据 package-lock.json 生成，随版本更新。`,
  '',
  '图标基于 Lucide（ISC License）的 Scale 轮廓重新绘制，许可文本见 build/icon-LICENSE。',
  '',
  ...rows.map((r) => [
    `## ${r.name}@${r.version}${r.direct ? '' : '（间接依赖）'}`,
    '',
    `许可：${r.license}`,
    '',
    r.text ? '```' + '\n' + r.text + '\n' + '```' : '（安装包内未附带许可文本；许可以软件包元数据为准。）',
  ].join('\n')),
]
process.stdout.write(lines.join('\n') + '\n')
