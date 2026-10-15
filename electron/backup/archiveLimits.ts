import * as yauzl from 'yauzl'
import * as crc32 from 'crc-32'

export interface ArchiveLimits {
  compressedBytes: number
  expandedBytes: number
  entryBytes: number
  manifestBytes: number
  entries: number
}
export const BACKUP_LIMITS: Readonly<ArchiveLimits> = {
  compressedBytes: 256 * 1024 * 1024,
  expandedBytes: 512 * 1024 * 1024,
  entryBytes: 256 * 1024 * 1024,
  manifestBytes: 4 * 1024 * 1024,
  entries: 20000,
}

/** 在 JSZip 的 CRC 检查前，逐条流式核验真实解压长度，防止压缩炸弹占满内存。 */
export async function validateArchiveLimits(buffer: Buffer, limits: ArchiveLimits): Promise<void> {
  if (buffer.length > limits.compressedBytes) throw new Error('备份压缩包超过容量限制')
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) { reject(new Error('备份 ZIP 无法读取或已损坏')); return }
      let count = 0, expanded = 0, settled = false
      const fail = (error: Error) => {
        if (settled) return
        settled = true; zip.close(); reject(error)
      }
      const keys = new Set<string>()
      zip.on('error', () => fail(new Error('备份 ZIP 已损坏或含有不安全路径')))
      zip.on('end', () => { if (!settled) { settled = true; resolve() } })
      zip.on('entry', (entry: yauzl.Entry) => {
        const key = entry.fileName.normalize('NFC').toLowerCase()
        const maximum = entry.fileName === 'manifest.json' ? limits.manifestBytes : limits.entryBytes
        if (++count > limits.entries || keys.has(key)) { fail(new Error('备份 ZIP 条目过多或路径重复')); return }
        keys.add(key)
        if (entry.uncompressedSize > maximum || expanded + entry.uncompressedSize > limits.expandedBytes) {
          fail(new Error('备份解压容量超过限制')); return
        }
        zip.openReadStream(entry, (error, stream) => {
          if (error || !stream) { fail(new Error('备份 ZIP 条目无法读取')); return }
          let size = 0, crc = 0
          stream.on('data', (chunk: Buffer) => {
            size += chunk.length; expanded += chunk.length
            if (size > maximum || expanded > limits.expandedBytes) {
              stream.destroy(new Error('备份解压容量超过限制')); return
            }
            crc = crc32.buf(chunk, crc)
          })
          stream.on('error', () => fail(new Error('备份 ZIP 已损坏或解压容量超过限制')))
          stream.on('end', () => {
            if (settled) return
            if (size !== entry.uncompressedSize || (crc >>> 0) !== entry.crc32) {
              fail(new Error('备份 ZIP 长度或 CRC 校验失败，文件已损坏')); return
            }
            zip.readEntry()
          })
        })
      })
      zip.readEntry()
    })
  })
}
