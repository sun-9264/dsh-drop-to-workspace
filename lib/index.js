// @dsh-external/dsh-drop-to-workspace — host 侧：拖拽落盘 HTTP 端点。
// 接收浏览器端 POST 的原始文件流（application/octet-stream），
// 文件名来自 ?name= 查询参数，用 node stream 直接写盘到工作区 _drop/ 并返回绝对路径。
import { mkdirSync, createWriteStream } from 'node:fs'
import { join, basename } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'

export const name = '@dsh-external/dsh-drop-to-workspace'
export const inject = ['webServer']

const DEFAULT_DROP_DIR = join(process.cwd(), '_drop')
const UPLOAD_PATH = '/@dsh-external/dsh-drop-to-workspace/upload'
const MAX_BYTES = 256 * 1024 * 1024 // 256 MiB 上限，防止失控

export function apply(ctx, config) {
  const dir = (config && typeof config.dropDir === 'string' && config.dropDir) || DEFAULT_DROP_DIR
  mkdirSync(dir, { recursive: true })
  ctx.logger?.info?.('[' + name + '] 拖拽落盘目录: ' + dir)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: UPLOAD_PATH,
    handler: async (req, res) => {
      const respond = (status, obj) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(obj))
      }
      if (req.method !== 'POST') { respond(405, { ok: false, error: 'method not allowed' }); return }
      let url
      try { url = new URL(req.url ?? '/', 'http://x') } catch { url = null }
      const origName = (url && url.searchParams.get('name')) || 'file'
      const safe = (basename(origName) || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120) || 'file'
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const out = join(dir, ts + '_' + safe)

      let size = 0
      const ws = createWriteStream(out)
      try {
        await pipeline(
          req,
          new Transform({
            transform(chunk, _enc, cb) {
              size += chunk.length
              if (size > MAX_BYTES) { cb(new Error('too large')); return }
              cb(null, chunk)
            }
          }),
          ws
        )
      } catch (e) {
        ws.destroy()
        respond(500, { ok: false, error: 'write failed: ' + String(e).slice(0, 120) })
        return
      }
      respond(200, { ok: true, path: out, name: origName, size })
    }
  }), name + ': upload route')
}
