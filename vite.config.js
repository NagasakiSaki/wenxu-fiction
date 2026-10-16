import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {resolve} from 'node:path';
export default defineConfig(({mode})=>{const native=mode==='native';return {
 base:native?'./':'/wenxu-fiction/',
 build:{outDir:native?'dist-native':'dist'},
 resolve:{alias:native?{'virtual:pwa-register':resolve('src/no-pwa.js')} :{}},
 plugins:native?[]:[VitePWA({registerType:'prompt',injectRegister:false,includeAssets:['icons/*.png','icons/*.svg'],manifest:{id:'/wenxu-fiction/',name:'文序 · 本地创作',short_name:'文序',description:'本地写作、自动分章与草稿文件互通',lang:'zh-CN',start_url:'./#/studio',scope:'./',display:'standalone',theme_color:'#365545',background_color:'#f7f7f1',icons:[{src:'icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},workbox:{globPatterns:['**/*.{html,js,mjs,css,png,svg,json,wasm,bcmap,pfb,ttf,otf,woff,woff2,txt}'],maximumFileSizeToCacheInBytes:8*1024*1024,cleanupOutdatedCaches:true,navigateFallback:'/wenxu-fiction/index.html',ignoreURLParametersMatching:[/^utm_/,/^fbclid$/,/^v$/]}})]
};});
