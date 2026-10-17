import {smartSplit} from './smart-split.js';

// 在 Worker 里跑整篇分章：清洗、规律识别与结构引擎都不会卡住输入框。
self.onmessage = ({data}) => {
  try {
    self.postMessage({result: smartSplit(data.text, data.options)});
  } catch (error) {
    self.postMessage({error: error.message});
  }
};
