package io.github.nagasakisaki.wenxu;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsProvider;
import java.io.File;
import java.io.FileNotFoundException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

// Debug-build-only SAF fixture. Not included in the shipped release application.
public class FixtureDocumentsProvider extends DocumentsProvider {
    private static final String[] COLUMNS={Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_FLAGS,Document.COLUMN_SIZE};
    private Object[] row(String id){switch(id){
        case "root":return new Object[]{id,"合成手稿",Document.MIME_TYPE_DIR,0,0};
        case "sub":return new Object[]{id,"第二卷",Document.MIME_TYPE_DIR,0,0};
        case "one":return new Object[]{id,"第一章.txt","text/plain",0,body(id).getBytes(StandardCharsets.UTF_8).length};
        case "two":return new Object[]{id,"第二章.md","text/markdown",0,body(id).getBytes(StandardCharsets.UTF_8).length};
        default:return new Object[]{id,"image.png","image/png",0,1};
    }}
    private String body(String id){return (id.equals("one")?"第一章 雨\n":"## 第二章 夜\n")+"这是一段用于系统文件夹导入验证的合成正文。".repeat(8);}
    @Override public boolean onCreate(){return true;}
    @Override public boolean isChildDocument(String parent,String child){return parent.equals("root")&&!child.equals("root")||parent.equals("sub")&&child.equals("two");}
    @Override public Cursor queryRoots(String[] projection){return new MatrixCursor(new String[]{"root_id","document_id","title","flags"});}
    @Override public Cursor queryDocument(String id,String[] projection){MatrixCursor cursor=new MatrixCursor(COLUMNS);cursor.addRow(row(id));return cursor;}
    @Override public Cursor queryChildDocuments(String parent,String[] projection,String sortOrder){MatrixCursor cursor=new MatrixCursor(COLUMNS);for(String id:parent.equals("root")?new String[]{"one","sub","image"}:new String[]{"two"})cursor.addRow(row(id));return cursor;}
    @Override public ParcelFileDescriptor openDocument(String id,String mode,CancellationSignal signal)throws FileNotFoundException{try{File file=new File(getContext().getCacheDir(),id+".txt");Files.write(file.toPath(),body(id).getBytes(StandardCharsets.UTF_8));return ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);}catch(Exception error){throw new FileNotFoundException(error.getMessage());}}
}
