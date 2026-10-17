// 智能分章的线程包装：有 Worker 时在后台运行，没有 Worker（测试、旧环境）时同步执行。
import {smartSplit} from './smart-split.js';

export async function runSmartSplit(text, options = {}, {timeoutMs = 30_000} = {}) {
  if (typeof Worker === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 0));
    return smartSplit(text, options);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./smart-split-worker.js', import.meta.url), {type: 'module'});
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      error ? reject(Error(error)) : resolve(result);
    };
    const timer = setTimeout(() => finish('智能分章超过30秒，请拆分文件后重试；原稿没有改动。'), timeoutMs);
    worker.onmessage = ({data}) => finish(data.error, data.result);
    worker.onerror = () => finish('智能分章未能完成，请重新打开或拆分文件；原稿没有改动。');
    worker.postMessage({text, options});
  });
}
