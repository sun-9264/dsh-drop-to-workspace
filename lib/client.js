// @dsh-external/dsh-drop-to-workspace — client 侧：浏览器全局拖拽落盘。
// 拦截拖入的任意文件，上传到 host 落盘端点；在输入栏停靠区显示最近保存路径，
// 并在页面右下角弹 toast。产物为 __ModuleLoader__.load CJS 包装。
window.__ModuleLoader__.load({ id: '@dsh-external/dsh-drop-to-workspace', factory: (require) => {
  var module = { exports: {} }
  var exports = module.exports

  var UPLOAD_PATH = '/@dsh-external/dsh-drop-to-workspace/upload'

  // 流式上传：直接把 File 作为 body，浏览器异步流式发送，不阻塞主线程（避免大文件卡界面）。
  function uploadFile(file) {
    var qs = new URLSearchParams()
    qs.set('name', file.name)
    return fetch(UPLOAD_PATH + '?' + qs.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: file
    }).then(function (r) { return r.json() }).then(function (j) {
      return j && j.ok ? j.path : null
    }).catch(function () { return null })
  }

  function showToast(lines) {
    var fixed = document.getElementById('dsh-drop-to-workspace-toast')
    if (!fixed) {
      fixed = document.createElement('div')
      fixed.id = 'dsh-drop-to-workspace-toast'
      fixed.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483000;max-width:60vw;' +
        'background:rgba(20,22,26,.96);color:#e6e6e6;padding:14px 16px;border-radius:12px;' +
        'font:13px/1.6 monospace;box-shadow:0 8px 30px rgba(0,0,0,.35);white-space:pre-wrap;word-break:break-all'
      document.body.appendChild(fixed)
    }
    fixed.textContent = lines.length ? lines.join('\n') : '已拖入文件并保存到工作区'
    fixed.style.opacity = '1'
    fixed.style.transition = 'opacity .5s'
    if (fixed.hideTimer) clearTimeout(fixed.hideTimer)
    fixed.hideTimer = setTimeout(function () { fixed.style.opacity = '0' }, 3000)
  }

  function uploadFiles(files) {
    return Promise.all(files.map(function (file) {
      return uploadFile(file)
    })).then(function (paths) {
      var saved = paths.filter(function (p) { return typeof p === 'string' })
      if (saved.length) showToast(saved.map(function (p) { return '✓ ' + p }))
      else showToast(['⚠ 拖拽落盘失败'])
    })
  }

  function apply(ctx) {
    // 全局拖拽拦截（capture 阶段抢先于 DSH 自身图片 drop 逻辑）
    ctx.effect(function () {
      var onDragOver = function (e) {
        if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault()
      }
      var onDrop = function (e) {
        var files = e.dataTransfer && e.dataTransfer.files
        if (!files || files.length === 0) return
        // 纯图片交给 DSH 原生模型识图（不落盘、不拦截），仅对非图片文件落盘
        var allImages = true
        for (var i = 0; i < files.length; i++) {
          if ((files[i].type || '').indexOf('image/') !== 0) { allImages = false; break }
        }
        if (allImages) return
        // 非图片文件：截断不让 DSH 当作图片附件接收（避免弹"仅支持图片"提示），只做落盘
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        // 手动派发 dragend，触达 DSH 的 window dragend → reset()，让其拖拽遮罩正常复位消失
        try { window.dispatchEvent(new Event('dragend')) } catch (_e) {}
        var list = []
        for (var j = 0; j < files.length; j++) list.push(files[j])
        uploadFiles(list)
      }
      window.addEventListener('dragover', onDragOver, true)
      window.addEventListener('drop', onDrop, true)
      return function () {
        window.removeEventListener('dragover', onDragOver, true)
        window.removeEventListener('drop', onDrop, true)
      }
    }, '@dsh-external/dsh-drop-to-workspace: global drop')

    // 输入栏停靠槽：显示拖拽落盘说明
    ctx.effect(function () {
      return ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register({
          name: 'conversation.input.dock',
          id: '@dsh-external/dsh-drop-to-workspace-panel',
          label: function () { return '拖拽落盘' },
          component: function () {
            return {
              render: function () {
                var el = document.createElement('div')
                el.textContent = '把文件拖进消息栏 → 自动保存到工作区并显示路径'
                el.style.cssText = 'font:12px/1.5 monospace;padding:6px 10px;color:#aaa'
                return el
              }
            }
          }
        })
      })
    }, '@dsh-external/dsh-drop-to-workspace: dock')
  }

  apply.inject = ['slots']
  module.exports = { name: '@dsh-external/dsh-drop-to-workspace', inject: ['slots'], apply: apply }
  return module.exports
} })
