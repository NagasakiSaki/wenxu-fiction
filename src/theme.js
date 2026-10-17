// 界面风格：纸墨（默认）与版画（鲁迅式木刻）。风格只影响样式，不影响任何数据。
const SKIN_KEY = 'wenxu-skin';

export const SKINS = [
  {id: 'paper', label: '纸墨', note: '默认的浅色纸墨阅读界面'},
  {id: 'woodcut', label: '版画', note: '黑红套色的木刻版画风格，适合夜间与沉浸阅读'}
];

export function normalizeSkin(value) {
  return SKINS.some(skin => skin.id === value) ? value : 'paper';
}

export function loadSkin() {
  try {
    return normalizeSkin(globalThis.localStorage?.getItem(SKIN_KEY));
  } catch {
    return 'paper';
  }
}

export function saveSkin(value) {
  const skin = normalizeSkin(value);
  try {
    globalThis.localStorage?.setItem(SKIN_KEY, skin);
  } catch {
    /* 存储不可用时只在本次页面生效 */
  }
  return skin;
}

/** 在可用风格之间循环。 */
export function nextSkin(current) {
  const index = SKINS.findIndex(skin => skin.id === normalizeSkin(current));
  return SKINS[(index + 1) % SKINS.length].id;
}

export function skinLabel(current) {
  return `${normalizeSkin(current) === 'woodcut' ? '版画' : '纸墨'} ◧`;
}

/** 把风格写到 <html data-theme="…">，样式表据此切换。 */
export function applySkin(value) {
  const skin = normalizeSkin(value);
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.dataset.theme = skin;
  return skin;
}
