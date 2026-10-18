package io.github.nagasakisaki.wenxu;

import static org.junit.Assert.*;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.os.SystemClock;
import android.view.MotionEvent;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class OfflineCreationTest {
    private String js(ActivityScenario<MainActivity> scenario, String code) throws Exception {
        AtomicReference<String> value = new AtomicReference<>(); CountDownLatch latch = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(code, result -> { value.set(result); latch.countDown(); }));
        assertTrue("WebView evaluation timed out", latch.await(10, TimeUnit.SECONDS));return value.get();
    }
    private void until(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 45000;
        while (System.currentTimeMillis() < deadline) { if ("true".equals(js(scenario, expression))) return; Thread.sleep(150); }
        fail("App condition timed out: " + expression + " body=" + js(scenario,"document.body.innerText.slice(-1000)"));
    }
    private void tapFileInput(ActivityScenario<MainActivity> scenario) throws Exception {tapFileInput(scenario,"#restore");}
    private void tapFileInput(ActivityScenario<MainActivity> scenario,String selector) throws Exception {
        String target=JSONObject.quote(selector);
        // File choosers require an actual user gesture; synthetic JS .click()
        // is deliberately blocked by WebView and would not test the app flow.
        // Secondary import actions live in disclosures. Follow their visible path
        // before injecting the real gesture required by Android's file chooser.
        js(scenario,"(()=>{const el=document.querySelector("+target+");const parents=[];for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')parents.unshift(p);for(const p of parents)if(!p.open)p.querySelector('summary').click();el.scrollIntoView({block:'center'});return true})()");
        until(scenario,"(()=>{const r=document.querySelector("+target+").getBoundingClientRect();return r.width>0&&r.height>0})()");
        JSONArray point=new JSONArray(js(scenario,"(()=>{const r=document.querySelector("+target+").getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,devicePixelRatio]})()"));
        int[] origin=new int[2];scenario.onActivity(activity->activity.getBridge().getWebView().getLocationOnScreen(origin));
        float x=origin[0]+(float)(point.getDouble(0)*point.getDouble(2)),y=origin[1]+(float)(point.getDouble(1)*point.getDouble(2));
        long now=SystemClock.uptimeMillis();Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+60,MotionEvent.ACTION_UP,x,y,0);
        instrumentation.sendPointerSync(down);instrumentation.sendPointerSync(up);down.recycle();up.recycle();
    }
    private void startNewDraft(ActivityScenario<MainActivity> scenario) throws Exception {
        String before=js(scenario,"document.querySelector('[data-field=id]').value");
        js(scenario,"document.querySelector('.draft-launcher [data-action=new]').click();true");
        until(scenario,"document.querySelector('[data-field=id]').value!=="+before);
    }
    @Test public void offlineBatchSaveReopenAndPortableDraftRoundTrip() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("io.github.nagasakisaki.wenxu",context.getPackageName());
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            until(scenario,"!!document.querySelector('#shelf-import')");
            js(scenario,"location.hash='/studio';true");
            until(scenario,"!!document.querySelector('#chapter-body')");
            assertEquals("true",js(scenario,"Capacitor.isNativePlatform() && location.hash==='#/studio'"));
            startNewDraft(scenario);
            js(scenario,"(()=>{const t=document.querySelector('#chapter-body');t.value='甲段。\\n\\n乙段。\\n\\n丙段。';t.dispatchEvent(new Event('input',{bubbles:true}));t.setSelectionRange(5,5);document.querySelector('#mark-chapter-point').click();t.setSelectionRange(10,10);document.querySelector('#mark-chapter-point').click();document.querySelector('#batch-chapter-split').click();document.querySelector('#confirm-batch-chapters').click();return true})()");
            until(scenario,"document.querySelectorAll('.editor-toc button').length===3 && !document.querySelector('dialog[open]')");
            File manifest=new File(context.getFilesDir(),"drafts/index.json");assertTrue(manifest.exists());
            JSONObject index=new JSONObject(new String(Files.readAllBytes(manifest.toPath()),StandardCharsets.UTF_8));
            String oldKey=index.getString("current");assertTrue(index.getJSONObject("entries").length()>=2);
            scenario.recreate();until(scenario,"!!document.querySelector('#shelf-import')");
            js(scenario,"location.hash='/studio';true");until(scenario,"document.querySelectorAll('.editor-toc button').length===3");
            assertEquals("\"甲段。\\n\\n\"",js(scenario,"document.querySelector('#chapter-body').value"));
            File exchange=new File(context.getCacheDir(),"portable-draft.json");
            Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",exchange);
            Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
            Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){
                @Override public Instrumentation.ActivityResult onStartActivity(Intent intent) {
                    if(Intent.ACTION_OPEN_DOCUMENT_TREE.equals(intent.getAction()))return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(DocumentsContract.buildTreeDocumentUri("io.github.nagasakisaki.wenxu.test.documents","root")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                    if(Intent.ACTION_CREATE_DOCUMENT.equals(intent.getAction())||Intent.ACTION_GET_CONTENT.equals(intent.getAction())||Intent.ACTION_OPEN_DOCUMENT.equals(intent.getAction()))return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION));
                    return null;
                }
            };
            instrumentation.addMonitor(monitor);
            try {
                js(scenario,"document.querySelector('[data-action=\"draft-export\"]').click();true");
                until(scenario,"document.querySelector('#toast').textContent.includes('文件已保存')");
                JSONObject backup=new JSONObject(new String(Files.readAllBytes(exchange.toPath()),StandardCharsets.UTF_8));
                assertEquals("wenxu-draft-v1",backup.getString("format"));assertEquals("android",backup.getString("platform"));assertEquals(3,backup.getJSONObject("draft").getJSONArray("chapters").length());
                tapFileInput(scenario);
                until(scenario,"document.querySelector('#toast').textContent.includes('已恢复作品')");
                JSONObject restored=new JSONObject(new String(Files.readAllBytes(manifest.toPath()),StandardCharsets.UTF_8));
                assertNotEquals(oldKey,restored.getString("current"));assertTrue(restored.getJSONObject("entries").has(oldKey));
                assertEquals(3,restored.getJSONObject("entries").getJSONObject(restored.getString("current")).getInt("chapters"));
                js(scenario,"document.querySelector('[data-action=\"local-publish\"]').click();true");
                until(scenario,"location.hash.startsWith('#/book/local-') && document.querySelector('.chapter-grid a')!==null");
                File shelfManifest=new File(context.getFilesDir(),"books/index.json");assertTrue(shelfManifest.exists());
                String localRoute=js(scenario,"location.hash");
                js(scenario,"document.querySelector('.chapter-grid a').click();true");
                until(scenario,"location.hash.startsWith('#/read/local-') && document.body.innerText.includes('甲段。')");
                assertEquals("true",js(scenario,"document.body.innerText.includes('甲段。')"));
                scenario.recreate();until(scenario,"!!document.querySelector('.book-card[href*=\"local-\"]')");
                js(scenario,"document.querySelector('.book-card[href*=\"local-\"]').click();true");until(scenario,"!!document.querySelector('.chapter-grid a')");
                js(scenario,"document.querySelector('.book-detail .primary').click();true");until(scenario,"document.body.innerText.includes('甲段。')");
                js(scenario,"location.hash='/shelf';true");
                until(scenario,"!!document.querySelector('.book-card[href*=\"local-\"]')");
                js(scenario,"document.querySelector('.book-card[href*=\"local-\"]').click();true");
                until(scenario,"location.hash==="+localRoute);
                js(scenario,"location.hash='/studio';true");until(scenario,"!!document.querySelector('#native-folder')");
                js(scenario,"Capacitor.nativePromise('DocumentAccess','pickFolder',{}).then(r=>document.body.dataset.fixtureTree=JSON.stringify(r));true");
                until(scenario,"!!document.body.dataset.fixtureTree");
                assertEquals(js(scenario,"document.body.dataset.fixtureTree"),"true",js(scenario,"JSON.parse(document.body.dataset.fixtureTree).files.some(f=>f.name==='第一章.txt')"));
                js(scenario,"document.querySelector('#native-folder').click();true");
                until(scenario,"!!document.querySelector('[data-review-source=\"0\"]')");
                assertEquals("true",js(scenario,"document.querySelector('#dialog h2').textContent.includes('2 章') && document.querySelectorAll('[data-review-source]').length===2 && document.querySelector('#dialog').textContent.includes('1 个跳过')"));
            } finally { instrumentation.removeMonitor(monitor); }
        }
    }
    @Test public void offlineExampleLearningPersistsAndReusesRules() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String prose="雨水落在站台上，他收好信，走向最后一盏亮着的灯。".repeat(8);
        File input=new File(context.getCacheDir(),"chapter-learning.txt");
        Files.write(input.toPath(),("01｜雨夜\n\n"+prose+"\n\n02｜灯火\n\n"+prose+"\n\n03｜来信\n\n"+prose).getBytes(StandardCharsets.UTF_8));
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",input);
        Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){
            @Override public Instrumentation.ActivityResult onStartActivity(Intent intent){
                if(Intent.ACTION_GET_CONTENT.equals(intent.getAction())||Intent.ACTION_OPEN_DOCUMENT.equals(intent.getAction()))return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                return null;
            }
        };
        instrumentation.addMonitor(monitor);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"!!document.querySelector('main')");js(scenario,"location.hash='/studio';true");until(scenario,"!!document.querySelector('#document')");
            startNewDraft(scenario);
            js(scenario,"document.querySelector('#import-mode').value='replace';true");tapFileInput(scenario,"#document");
            until(scenario,"!!document.querySelector('[data-review-source=\"0\"]')");js(scenario,"document.querySelector('[data-review-source=\"0\"]').click();true");
            until(scenario,"!!document.querySelector('[data-example-positive=\"5\"]')");
            js(scenario,"document.querySelector('[data-example-positive=\"1\"]').click();document.querySelector('[data-example-positive=\"5\"]').click();document.querySelector('#learn-headings').click();true");
            until(scenario,"!!document.querySelector('#apply-import') && document.querySelector('#dialog h2').textContent.includes('3 章')");
            assertEquals("true",js(scenario,"document.querySelector('#dialog').textContent.includes('原文覆盖核对通过')"));
            js(scenario,"document.querySelector('#apply-import').click();true");until(scenario,"document.querySelectorAll('.editor-toc button').length===3 && !document.querySelector('dialog[open]')");
            File manifest=new File(context.getFilesDir(),"drafts/index.json");JSONObject index=new JSONObject(new String(Files.readAllBytes(manifest.toPath()),StandardCharsets.UTF_8));
            String snapshot=index.getJSONObject("entries").getJSONObject(index.getString("current")).getString("file");
            JSONObject saved=new JSONObject(new String(Files.readAllBytes(new File(context.getFilesDir(),snapshot).toPath()),StandardCharsets.UTF_8));
            assertTrue(saved.getJSONArray("chapterProfiles").length()>0);
            assertEquals("wenxu-heading-profile-v1",saved.getJSONArray("chapterProfiles").getJSONObject(0).getString("format"));
            scenario.recreate();until(scenario,"!!document.querySelector('main')");js(scenario,"location.hash='/studio';true");until(scenario,"!!document.querySelector('#document')");
            tapFileInput(scenario,"#document");until(scenario,"!!document.querySelector('[data-review-source=\"0\"]')");js(scenario,"document.querySelector('[data-review-source=\"0\"]').click();true");
            until(scenario,"!!document.querySelector('#use-heading-profile')");js(scenario,"document.querySelector('#use-heading-profile').click();true");
            until(scenario,"!!document.querySelector('#apply-import') && document.querySelector('#dialog h2').textContent.includes('3 章')");
        }finally{instrumentation.removeMonitor(monitor);}
    }

    @Test public void offlineForumSerialReviewArchiveAndReopen() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String[] bodies={
            "故事说明。\n第0话 纸灯\n甲乙丙丁。\n[rd100=6]\n1-5等待\n6-10出发",
            "第0话剧情预计在旅途结束后继续\n第1话 海岸\n旅人看见了远处的船。\n第一话 海岸 完\n第二话 回声",
            "第二话 回声\n旅人读完了手中的信。\n示例作品 入学篇\n第一话 新客\n清晨，有人敲响了门。"
        };
        StringBuilder text=new StringBuilder();
        for(int i=0;i<bodies.length;i++)text.append("#").append(i).append("示例作者 111111\n级别: 学徒威望: 1注册: 25-01-01\n2026-01-01 12:0").append(i).append("\n7\u200B\n\n").append(bodies[i]).append("\n附件\n显示全部附件\n");
        File input=new File(context.getCacheDir(),"forum-serial.txt");Files.write(input.toPath(),text.toString().getBytes(StandardCharsets.UTF_8));
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",input);
        Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){@Override public Instrumentation.ActivityResult onStartActivity(Intent intent){if(Intent.ACTION_GET_CONTENT.equals(intent.getAction())||Intent.ACTION_OPEN_DOCUMENT.equals(intent.getAction()))return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));return null;}};
        instrumentation.addMonitor(monitor);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"!!document.querySelector('main')");js(scenario,"location.hash='/studio';true");until(scenario,"!!document.querySelector('#document')");startNewDraft(scenario);
            tapFileInput(scenario,"#document");until(scenario,"!!document.querySelector('#apply-import') && document.querySelector('#dialog h2').textContent.includes('5 章')");
            assertEquals("true",js(scenario,"document.querySelector('#dialog').textContent.includes('3 个帖子') && document.querySelector('#dialog').textContent.includes('原文覆盖核对通过')"));
            js(scenario,"(()=>{const b=document.querySelector('[data-serial-import-line]');b.closest('details').querySelector('summary').click();b.click();return true})()");
            until(scenario,"!!document.querySelector('#visual-adopt') && document.querySelector('#visual-preview-status').textContent.includes('5 章')");
            js(scenario,"(()=>{document.querySelector('#visual-find').value='甲乙丙丁';document.querySelector('#visual-find-next').click();const t=document.querySelector('#visual-source-text'),at=t.selectionStart+2;t.setSelectionRange(at,at);t.dispatchEvent(new Event('select'));document.querySelector('#visual-mark-break').click();return true})()");
            until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('6 章') && !document.querySelector('#visual-undo').disabled");
            js(scenario,"document.querySelector('#visual-undo').click();true");
            until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('5 章') && !document.querySelector('#visual-adopt').disabled");
            js(scenario,"document.querySelector('#visual-adopt').click();document.querySelector('#apply-import').click();true");
            until(scenario,"document.querySelectorAll('.editor-toc button').length===5 && !document.querySelector('dialog[open]')");
            JSONObject index=new JSONObject(new String(Files.readAllBytes(new File(context.getFilesDir(),"drafts/index.json").toPath()),StandardCharsets.UTF_8));
            String snapshot=index.getJSONObject("entries").getJSONObject(index.getString("current")).getString("file");
            JSONObject saved=new JSONObject(new String(Files.readAllBytes(new File(context.getFilesDir(),snapshot).toPath()),StandardCharsets.UTF_8));
            assertEquals("示例作品 入学篇",saved.getJSONArray("chapters").getJSONObject(4).getString("volume"));
            assertTrue(saved.getJSONObject("importSource").getString("text").contains("111111"));
            assertTrue(saved.getJSONArray("importNotes").toString().contains("111111"));
            assertFalse(saved.getJSONArray("chapters").toString().contains("111111"));
            assertTrue(saved.getJSONArray("chapters").toString().contains("[rd100=6]"));
            scenario.recreate();until(scenario,"!!document.querySelector('main')");js(scenario,"location.hash='/studio';true");until(scenario,"document.querySelectorAll('.editor-toc button').length===5");
        }finally{instrumentation.removeMonitor(monitor);}
    }

    private void tapSourceInsideFirstBody(ActivityScenario<MainActivity> scenario) throws Exception {
        js(scenario,"document.querySelector('#visual-source-text').scrollIntoView({block:'center'});true");
        JSONArray point=new JSONArray(js(scenario,"(()=>{const t=document.querySelector('#visual-source-text'),r=t.getBoundingClientRect(),s=getComputedStyle(t),canvas=document.createElement('canvas'),c=canvas.getContext('2d');c.font=s.fontSize+' '+s.fontFamily;return [r.left+parseFloat(s.paddingLeft)+c.measureText('甲段。').width+1,r.top+parseFloat(s.paddingTop)+2.5*parseFloat(s.lineHeight),devicePixelRatio]})()"));
        int[] origin=new int[2];scenario.onActivity(activity->activity.getBridge().getWebView().getLocationOnScreen(origin));
        float x=origin[0]+(float)(point.getDouble(0)*point.getDouble(2)),y=origin[1]+(float)(point.getDouble(1)*point.getDouble(2));
        long now=SystemClock.uptimeMillis();Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+70,MotionEvent.ACTION_UP,x,y,0);
        instrumentation.sendPointerSync(down);instrumentation.sendPointerSync(up);down.recycle();up.recycle();
    }
    @Test public void offlineVisualSourceHeadingCursorUndoAndImport() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();File input=new File(context.getCacheDir(),"visual-source.txt");
        Files.write(input.toPath(),"雨夜\n\n甲段。乙段。\n\n灯火\n\n丙段。丁段。".getBytes(StandardCharsets.UTF_8));
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",input);Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){@Override public Instrumentation.ActivityResult onStartActivity(Intent intent){if(Intent.ACTION_GET_CONTENT.equals(intent.getAction())||Intent.ACTION_OPEN_DOCUMENT.equals(intent.getAction()))return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));return null;}};
        instrumentation.addMonitor(monitor);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"!!document.querySelector('main')");js(scenario,"location.hash='/studio';true");until(scenario,"!!document.querySelector('#document')");startNewDraft(scenario);
            tapFileInput(scenario,"#document");until(scenario,"!!document.querySelector('[data-visual-source=\"0\"]')");js(scenario,"document.querySelector('[data-visual-source=\"0\"]').click();true");
            until(scenario,"!!document.querySelector('#visual-mark-heading')");js(scenario,"document.querySelector('#visual-mark-heading').click();true");until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('1 个标题') && !document.querySelector('#visual-mark-heading').disabled");
            js(scenario,"document.querySelector('#visual-find').value='灯火';document.querySelector('#visual-find-next').click();document.querySelector('#visual-mark-heading').click();true");
            until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('2 章') && !document.querySelector('#visual-mark-heading').disabled");
            tapSourceInsideFirstBody(scenario);
            until(scenario,"document.querySelector('#visual-source-text').selectionStart===7 && document.querySelector('#visual-cursor-status').textContent.includes('第 7 字符')");
            js(scenario,"document.querySelector('#visual-mark-break').click();true");until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('3 章') && !document.querySelector('#visual-undo').disabled");
            js(scenario,"document.querySelector('#visual-undo').click();true");until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('2 章') && !document.querySelector('#visual-mark-break').disabled");
            js(scenario,"document.querySelector('#visual-mark-break').click();true");until(scenario,"document.querySelector('#visual-preview-status').textContent.includes('3 章') && !document.querySelector('#visual-adopt').disabled");
            js(scenario,"document.querySelector('#visual-adopt').click();document.querySelector('#apply-import').click();true");until(scenario,"document.querySelectorAll('.editor-toc button').length===3 && !document.querySelector('dialog[open]')");
            assertEquals("\"甲段。\"",js(scenario,"document.querySelector('#chapter-body').value"));
            scenario.recreate();until(scenario,"!!document.querySelector('main')");js(scenario,"location.hash='/studio';true");until(scenario,"document.querySelectorAll('.editor-toc button').length===3");
            js(scenario,"document.querySelector('[data-chapter=\"1\"]').click();true");assertEquals("\"乙段。\"",js(scenario,"document.querySelector('#chapter-body').value"));
        }finally{instrumentation.removeMonitor(monitor);}
    }

}
