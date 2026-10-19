package io.github.nagasakisaki.wenxu;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@CapacitorPlugin(name = "DocumentAccess")
public class DocumentAccessPlugin extends Plugin {
    @PluginMethod
    public void saveText(PluginCall call) {
        String name = call.getString("filename"), text = call.getString("text");
        if (name == null || text == null || text.length() > 32 * 1024 * 1024) { call.reject("文件内容无效或超过32MB字符限制"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        String mime = call.getString("mime", "application/json");
        intent.setType(("text/plain".equals(mime) || "text/markdown".equals(mime)) ? mime : "application/json");
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "savedDocument");
    }
    @ActivityCallback
    private void savedDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.resolve(new JSObject().put("cancelled", true)); return; }
        Uri uri = result.getData().getData();
        getBridge().execute(() -> {
            try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new Exception("无法写入所选位置");
                out.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception error) { call.reject("文件保存失败：" + error.getMessage()); }
        });
    }
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderSelected");
    }
    @ActivityCallback
    private void folderSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.resolve(new JSObject().put("cancelled", true)); return; }
        Uri uri = result.getData().getData();
        getBridge().execute(() -> {
            try {
                DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
                if (root == null) throw new Exception("无法读取文件夹");
                JSArray files = new JSArray(); long[] counts = {0,0,0};
                collect(root, root.getName() == null ? "手稿" : root.getName(), files, counts, 0);
                call.resolve(new JSObject().put("files", files));
            } catch (Exception error) { call.reject(error.getMessage()); }
        });
    }
    private void collect(DocumentFile node, String path, JSArray files, long[] counts, int depth) throws Exception {
        if (depth > 24 || ++counts[2] > 5000) throw new Exception("文件夹层级或项目过多，请选择更小的子文件夹");
        if (node.isDirectory()) {
            for (DocumentFile child : node.listFiles()) { String name = child.getName(); if (name != null && !name.startsWith(".") && !name.equals("__MACOSX")) collect(child, path + "/" + name, files, counts, depth + 1); }
        } else if (node.isFile()) {
            String name = node.getName() == null ? "未命名" : node.getName();
            boolean supported = !name.startsWith("~$") && name.toLowerCase(Locale.ROOT).matches(".*\\.(txt|md|markdown|docx|pdf)$");
            if (supported) {
                if (++counts[0] > 100) throw new Exception("一次最多导入100个文档，请选择更小的文件夹");
                if (node.length() > 10 * 1024 * 1024) throw new Exception(name + " 超过单文件10MB上限");
                counts[1] += node.length(); if (counts[1] > 50 * 1024 * 1024) throw new Exception("文件夹文档合计超过50MB，请分批导入");
            }
            files.put(new JSObject().put("name", name).put("path", path).put("uri", node.getUri().toString()).put("size", node.length()));
        }
    }
}
