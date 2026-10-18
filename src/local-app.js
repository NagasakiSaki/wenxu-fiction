import {registerSW} from 'virtual:pwa-register';
import {isNative} from './platform-runtime.js';
let installEvent=null,offlineReady=false,updateAvailable=false,updateSW=async()=>{},saveCurrent=async()=>{};
export function localAppMarkup(){return `<main class="local-app-page"><span class="eyebrow">WENXU LOCAL STUDIO · 2.6.0</span><h1>手稿留在本机，创作不必联网。</h1><p>${isNative()?'安卓本地版：程序、分章引擎与文档转换资源已内置。草稿与本地书架全文保存在应用私有文件中。':'安卓安装包与可安装的 Windows 桌面 Web 应用，共用同一套编辑和分章功能。'}</p><div class="local-app-cards"><section><h2>安卓本地应用</h2><p>Android 8及以上，需较新的系统 WebView。安装后可离线创作、示例学习分章、整书体检、场景断点建议、查看草稿和阅读。</p>${isNative()?'<strong>你正在使用安卓本地版</strong>':'<a class="primary" href="https://github.com/NagasakiSaki/wenxu-fiction/releases/latest/download/wenxu-android.apk">下载安卓 APK</a>'}<p><small>系统“文件”选择器导入文档/文件夹；导出时自行选择保存位置。卸载应用会清除其私有草稿，请先导出备份。</small></p></section><section><h2>Windows 离线桌面版</h2><p>在 Edge 或 Chrome 中打开本站，通过浏览器的“安装此网站为应用”即可安装。首次联网缓存完成后可离线启动。</p><button id="install-local-app" ${isNative()?'disabled':''}>安装桌面 Web 应用</button><p id="offline-state">${isNative()?'安卓包已内置离线资源':'正在检查离线资源……'}</p><button id="update-local-app" hidden>保存草稿并更新应用</button><small>此版本为可安装的 PWA，尚不是 Windows EXE。在线书库更新需联网并接受应用更新。</small></section><section><h2>本地书架，断网阅读</h2><ol><li>在工作台导入文档并校正章节。</li><li>点击“存入本地书架并阅读”，在本机生成阅读副本。</li><li>从“我的书架”继续阅读，支持书签、翻页、字体和进度。</li></ol><p>不需要 GitHub、不上传网络。再次编辑草稿后，点击同一按钮更新阅读副本。书架中的“导入作品”可直接接收另一台设备导出的 JSON。</p><a class="primary" href="#/shelf">打开本地书架 →</a></section><section><h2>通过文件在两端接力</h2><ol><li>在工作台点击“备份当前草稿”，导出 JSON。</li><li>用数据线、文件传输或自行选择的方式将文件送到另一台设备。</li><li>打开“恢复作品文件”，选择该 JSON，另存为独立草稿。</li></ol><p>保留作品编号、资料、章节和顺序；未完成作品和空草稿也支持。文件传输不等于自动同步，两端同时修改需自行核对版本。</p><a href="#/studio" class="primary">打开作者工作台 →</a></section></div><p>草稿文件使用兼容格式 <code>wenxu-draft-v1</code>，含导出时间与来源平台。没有登录、云端草稿或后台上传；发布到公开网站仍需作者主动提交。</p></main>`;}
function updateStatus(){const el=document.querySelector('#offline-state');if(el)el.textContent=isNative()?'安卓包已内置离线资源':offlineReady?'离线资源已准备好，可断网创作':import.meta.env.DEV?'开发预览不启用离线缓存，请使用已发布版本':'离线资源正在准备，首次完成前请保持联网';const update=document.querySelector('#update-local-app');if(update)update.hidden=!updateAvailable;}
export function bindLocalApp({toast}){updateStatus();document.querySelector('#install-local-app').onclick=async()=>{if(!installEvent){toast('请使用 Edge / Chrome 浏览器菜单中的“安装应用”；当前浏览器可能不支持安装');return;}await installEvent.prompt();await installEvent.userChoice;installEvent=null;};document.querySelector('#update-local-app').onclick=async()=>{try{await saveCurrent();await updateSW(true);}catch(error){toast('更新前保存未完成：'+error.message);}};}
export function initLocalApp({save,toast}){
 saveCurrent=save;
 if(isNative()){
  document.body.classList.add('native-app');
  import('@capacitor/app').then(({App})=>{
   App.addListener('appStateChange',({isActive})=>{if(!isActive)save().catch(error=>toast('离开前保存失败：'+error.message));});
   App.addListener('backButton',async({canGoBack})=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return;}if(canGoBack){history.back();return;}if(location.hash!=='#/studio'){location.hash='/studio';return;}try{await save();await App.exitApp();}catch(error){toast('保存失败，请先导出备份：'+error.message);}});
  }).catch(error=>toast('安卓生命周期初始化失败：'+error.message));return;
 }
 if(import.meta.env.DEV)return;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});
 updateSW=registerSW({onOfflineReady(){offlineReady=true;updateStatus();toast('离线资源已就绪，可在“本地应用”页面安装');},onNeedRefresh(){updateAvailable=true;updateStatus();toast('有新版本，可在“本地应用”中保存草稿后更新');},onRegisterError(){toast('离线缓存未完成，请保持联网后重试');}});
 navigator.serviceWorker?.ready.then(()=>{offlineReady=true;updateStatus();});
}
