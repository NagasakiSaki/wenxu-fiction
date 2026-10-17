import {isNative} from './platform-runtime.js';
const MAX_EXPORT_BYTES = 32 * 1024 * 1024;

/** 统一的文本导出：网页触发下载，安卓走系统“另存为”。 */
export async function exportTextFile(filename, text, {mime = 'text/plain'} = {}) {
  const safeName = filename.replace(/[^\w\u4e00-\u9fff.\-]/g, '_').slice(0, 160);
  if (new TextEncoder().encode(text).byteLength > MAX_EXPORT_BYTES) throw Error('导出文件超过32MB，请减少附加资料');
  if (isNative()) {
    const {DocumentAccess} = await import('./native-documents.js');
    const result = await DocumentAccess.saveText({filename: safeName, text});
    return result.cancelled ? '已取消导出' : '文件已保存到所选位置，可传送到另一台设备';
  }
  const url = URL.createObjectURL(new Blob([text], {type: mime}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return '已生成下载文件';
}

export async function exportJsonFile(filename, value) {
  return exportTextFile(filename, JSON.stringify(value, null, 2), {mime: 'application/json'});
}
