import { ref } from 'vue'
import { usePermission } from '@vueuse/core'

/**
 * Composable for interacting with the system clipboard.
 * 封装了与系统剪贴板交互的功能。
 */
export function useClipboard() {
  const permissionRead = usePermission('clipboard-read')
  const permissionWrite = usePermission('clipboard-write')

  const isSupported = navigator && 'clipboard' in navigator
  const error = ref<Error | null>(null)
  const text = ref<string | null>(null)

  /**
   * Writes text to the clipboard.
   * 将文本写入剪贴板。
   * @param value - The text to write. 要写入的文本。
   */
  async function writeText(value: string): Promise<void> {
    error.value = null
    if (!isSupported) {
      error.value = new Error('Clipboard API not supported.')
      console.error(error.value)
      return
    }
    if (permissionWrite.value !== 'granted' && permissionWrite.value !== 'prompt') {
      error.value = new Error('Clipboard write permission not granted.')
      console.error(error.value)
      // 可以考虑在这里提示用户授权，或者让调用者处理
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      text.value = value // 更新本地状态，表示最近写入的内容
    } catch (e) {
      error.value = e as Error
      console.error('Failed to write to clipboard:', e)
    }
  }

  /**
   * Reads text from the clipboard.
   * 从剪贴板读取文本。
   * @returns The text read from the clipboard, or null if an error occurred. 从剪贴板读取的文本，如果发生错误则为 null。
   */
  async function readText(): Promise<string | null> {
    error.value = null
    text.value = null
    if (!isSupported) {
      error.value = new Error('Clipboard API not supported.')
      console.error(error.value)
      return null
    }
    if (permissionRead.value !== 'granted' && permissionRead.value !== 'prompt') {
      error.value = new Error('Clipboard read permission not granted.')
      console.error(error.value)
      // 可以考虑在这里提示用户授权，或者让调用者处理
      return null
    }

    try {
      const value = await navigator.clipboard.readText()
      text.value = value
      return value
    } catch (e) {
      error.value = e as Error
      console.error('Failed to read from clipboard:', e)
      return null
    }
  }

  return {
    isSupported,
    text, // 最近写入或读取的文本
    writeText,
    readText,
    error, // 最近一次操作的错误信息
    permissionRead,
    permissionWrite,
  }
}