import fs from 'node:fs'
import path from 'node:path'
import dayjs from 'dayjs'

function pathIsInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

/** 即便末级目录不存在，也解析最近的已有祖先，避免符号链接绕过边界。 */
async function canonicalPath(value: string): Promise<string> {
  const absolute = path.resolve(value)
  try { return await fs.promises.realpath(absolute) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const parent = path.dirname(absolute)
    if (parent === absolute) throw error
    return path.join(await canonicalPath(parent), path.basename(absolute))
  }
}

export async function validateExportParent(parent: string, protectedDirectories: readonly string[]): Promise<void> {
  const canonicalParent = await canonicalPath(parent)
  const protectedPaths = await Promise.all(protectedDirectories.map(canonicalPath))
  if (protectedPaths.some((root) => pathIsInside(canonicalParent, root))) {
    throw new Error('导出位置不能位于律衡数据、附件或程序目录内，请选择桌面、文稿等其他目录')
  }
}

export async function createUniqueExportDirectory(parent: string, now = new Date()): Promise<string> {
  const base = `律衡导出-${dayjs(now).format('YYYYMMDD-HHmm')}`
  for (let index = 1; index <= 100; index++) {
    const directory = path.join(parent, index === 1 ? base : `${base}-${index}`)
    try { await fs.promises.mkdir(directory); return directory } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('同一分钟内的同名导出目录过多，请稍后重试')
}

export async function exportToDirectory<T>(
  parent: string, protectedDirectories: readonly string[], write: (directory: string) => Promise<T>,
): Promise<{ directory: string; result: T }> {
  await validateExportParent(parent, protectedDirectories)
  const directory = await createUniqueExportDirectory(parent)
  try { return { directory, result: await write(directory) } } catch (error) {
    try { await fs.promises.rm(directory, { recursive: true, force: true }) } catch (cleanupError) {
      console.error('清理失败的数据导出目录时出错', cleanupError)
      throw new Error('导出未完成，且未能清理本次导出目录，请检查所选位置后重试')
    }
    throw error
  }
}
