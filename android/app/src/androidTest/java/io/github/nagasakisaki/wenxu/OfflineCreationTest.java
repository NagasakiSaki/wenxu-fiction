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
    private void tapFileInput(ActivityScenario<MainActivity> scenario) throws Exception {
        // File choosers require an actual user gesture; synthetic JS .click()
        // is deliberately blocked by WebView and would not test the app flow.
        js(scenario,"document.querySelector('#restore').scrollIntoView({block:'center'});true");
        JSONArray point=new JSONArray(js(scenario,"(()=>{const r=document.querySelector('#restore').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,devicePixelRatio]})()"));
        int[] origin=new int[2];scenario.onActivity(activity->activity.getBridge().getWebView().getLocationOnScreen(origin));
        float x=origin[0]+(float)(point.getDouble(0)*point.getDouble(2)),y=origin[1]+(float)(point.getDouble(1)*point.getDouble(2));
        long now=SystemClock.uptimeMillis();Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+60,MotionEvent.ACTION_UP,x,y,0);
        instrumentation.sendPointerSync(down);instrumentation.sendPointerSync(up);down.recycle();up.recycle();
    }
    @Test public void offlineBatchSaveReopenAndPortableDraftRoundTrip() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("io.github.nagasakisaki.wenxu",context.getPackageName());
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            until(scenario,"!!document.querySelector('#chapter-body')");
            assertEquals("true",js(scenario,"Capacitor.isNativePlatform() && location.hash==='#/studio'"));
            js(scenario,"(()=>{const t=document.querySelector('#chapter-body');t.value='甲段。\\n\\n乙段。\\n\\n丙段。';t.dispatchEvent(new Event('input',{bubbles:true}));t.setSelectionRange(5,5);document.querySelector('#mark-chapter-point').click();t.setSelectionRange(10,10);document.querySelector('#mark-chapter-point').click();document.querySelector('#batch-chapter-split').click();document.querySelector('#confirm-batch-chapters').click();return true})()");
            until(scenario,"document.querySelectorAll('.editor-toc button').length===3 && !document.querySelector('dialog[open]')");
            File manifest=new File(context.getFilesDir(),"drafts/index.json");assertTrue(manifest.exists());
            JSONObject index=new JSONObject(new String(Files.readAllBytes(manifest.toPath()),StandardCharsets.UTF_8));
            String oldKey=index.getString("current");assertEquals(2,index.getJSONObject("entries").length());
            scenario.recreate();until(scenario,"document.querySelectorAll('.editor-toc button').length===3");
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
                js(scenario,"Capacitor.nativePromise('DocumentAccess','pickFolder',{}).then(r=>document.body.dataset.fixtureTree=JSON.stringify(r));true");
                until(scenario,"!!document.body.dataset.fixtureTree");
                assertEquals(js(scenario,"document.body.dataset.fixtureTree"),"true",js(scenario,"JSON.parse(document.body.dataset.fixtureTree).files.some(f=>f.name==='第一章.txt')"));
                js(scenario,"document.querySelector('#native-folder').click();true");
                until(scenario,"!!document.querySelector('[data-review-source=\"0\"]')");
                assertEquals("true",js(scenario,"document.querySelector('#dialog h2').textContent.includes('2 章') && document.querySelectorAll('[data-review-source]').length===2 && document.querySelector('#dialog').textContent.includes('1 个跳过')"));
            } finally { instrumentation.removeMonitor(monitor); }
        }
    }
}
