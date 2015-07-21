package de.phiresky.androidrtc;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;
import org.webrtc.DataChannel;

import java.nio.ByteBuffer;
import java.util.AbstractMap;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class PenSyncActivity extends Activity implements View.OnTouchListener, View.OnHoverListener {
    static DataChannel channel;
    private TextView textView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout test = new LinearLayout(this);
        setContentView(test);
        test.addView(textView = new TextView(this));
        textView.setText("hehehe");
        test.setOnTouchListener(this);
        test.setOnHoverListener(this);
    }

    @Override
    public boolean onTouch(View v, MotionEvent event) {
        textView.setText(event.getActionMasked() + "press:" + event.getPressure());
        JSONObject x = json(
                entry("event", "touch"),
                entry("action", event.getActionMasked()),
                entry("pressure", event.getPressure()),
                entry("x", event.getX()),
                entry("y", event.getY()),
                entry("tooltype", event.getToolType(0))
        );
        send(x.toString());
        return true;
    }

    @Override
    public boolean onHover(View v, MotionEvent event) {
        textView.setText(event.getActionMasked() + " hovering:" + event.getPressure());
        JSONObject x = json(
                entry("event", "hover"),
                entry("action", event.getActionMasked()),
                entry("pressure", event.getPressure()),
                entry("x", event.getX()),
                entry("y", event.getY()),
                entry("tooltype", event.getToolType(0))
        );
        send(x.toString());
        return true;
    }

    private void send(String data) {
        channel.send(new DataChannel.Buffer(ByteBuffer.wrap(data.getBytes()), false));
    }

    private static <T> Map.Entry<String, T> entry(String x, T ele) {
        return new AbstractMap.SimpleImmutableEntry<String, T>(x, ele);
    }

    private JSONObject json(Map.Entry<String, ?>... entries) {
        try {
            JSONObject o = new JSONObject();
            for (Map.Entry<String, ?> en : entries) {
                o.put(en.getKey(), en.getValue());
            }
            return o;
        } catch (JSONException e) {
            Toast.makeText(getApplicationContext(), e.getMessage(), Toast.LENGTH_LONG).show();
            e.printStackTrace();
        }
        return null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        if(intent.getAction().equals("close")) {
            setResult(Activity.RESULT_OK);
            finish();
        }
    }
}
