/**
 * Sandbox-рантайм: хост Figma API.
 * Принимает команды от UI, сериализует SceneNode и работает с clientStorage/pluginData.
 */
import { postToUi, type UiToSandbox } from '../shared/messages'
import { serializeTree } from '../shared/serialize'

const UI_WIDTH = 420
const UI_HEIGHT = 680

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true })

postToUi({
  type: 'init',
  documentName: figma.root.name,
  userName: figma.currentUser?.name ?? null,
})

function currentSelectionPayload() {
  const nodes = figma.currentPage.selection.flatMap((n) => serializeTree(n))
  return { nodes, selectionIds: figma.currentPage.selection.map((n) => n.id) }
}

figma.on('selectionchange', () => {
  postToUi({ type: 'selection-changed', payload: currentSelectionPayload() })
})

figma.ui.onmessage = async (msg: UiToSandbox) => {
  switch (msg.type) {
    case 'ui-ready':
    case 'request-selection':
      postToUi({ type: 'selection-changed', payload: currentSelectionPayload() })
      return

    case 'run-audit': {
      const roots = msg.scope === 'page' ? [figma.currentPage] : figma.currentPage.selection
      const nodes = roots.flatMap((n) => serializeTree(n as SceneNode))
      postToUi({
        type: 'audit-nodes',
        payload: { nodes, selectionIds: figma.currentPage.selection.map((n) => n.id) },
      })
      return
    }

    case 'export-frame': {
      const node = await figma.getNodeByIdAsync(msg.nodeId)
      if (!node || !('exportAsync' in node)) {
        postToUi({ type: 'export-error', requestId: msg.requestId, nodeId: msg.nodeId, error: 'Нода не поддерживает экспорт.' })
        return
      }
      try {
        const bytes = await (node as SceneNode & { exportAsync: (s: ExportSettings) => Promise<Uint8Array> }).exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: msg.scale },
        })
        postToUi({ type: 'export-result', requestId: msg.requestId, nodeId: msg.nodeId, pngBase64: figma.base64Encode(bytes) })
      } catch (e) {
        postToUi({ type: 'export-error', requestId: msg.requestId, nodeId: msg.nodeId, error: String(e) })
      }
      return
    }

    case 'jump-to-node': {
      const node = await figma.getNodeByIdAsync(msg.nodeId)
      if (node && 'type' in node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
        figma.currentPage.selection = [node as SceneNode]
        figma.viewport.scrollAndZoomIntoView([node as SceneNode])
      }
      return
    }

    case 'client-storage-get': {
      const value = (await figma.clientStorage.getAsync(msg.key)) as string | undefined
      postToUi({ type: 'storage-value', requestId: msg.requestId, value: value ?? null })
      return
    }

    case 'client-storage-set': {
      if (msg.value === null) await figma.clientStorage.deleteAsync(msg.key)
      else await figma.clientStorage.setAsync(msg.key, msg.value)
      postToUi({ type: 'storage-ack', requestId: msg.requestId })
      return
    }

    case 'plugin-data-get': {
      const v = figma.root.getPluginData(msg.key)
      postToUi({ type: 'storage-value', requestId: msg.requestId, value: v || null })
      return
    }

    case 'plugin-data-set': {
      figma.root.setPluginData(msg.key, msg.value)
      postToUi({ type: 'storage-ack', requestId: msg.requestId })
      return
    }

    case 'notify':
      figma.notify(msg.message, { error: msg.error })
      return

    case 'close-plugin':
      figma.closePlugin()
      return

    default: {
      const _exhaustive: never = msg
      void _exhaustive
    }
  }
}
