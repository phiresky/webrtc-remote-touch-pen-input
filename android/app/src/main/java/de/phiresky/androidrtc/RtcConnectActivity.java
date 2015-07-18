package de.phiresky.androidrtc;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager.LayoutParams;
import android.widget.Toast;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.webrtc.DataChannel;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.LinkedList;

public class RtcConnectActivity extends Activity implements PeerConnection.Observer {
    private LinkedList<PeerConnection.IceServer> iceServers = new LinkedList<>();
    private PeerConnection pc;
    private MediaConstraints pcConstraints;
    private String server, key;

    //private PeerConnectionParameters pcParams = new PeerConnectionParameters(false, false, 0,0,0,0,null,false,0,null,false);
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(
                LayoutParams.FLAG_FULLSCREEN
                        | LayoutParams.FLAG_KEEP_SCREEN_ON
                        | LayoutParams.FLAG_DISMISS_KEYGUARD
                        | LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        | LayoutParams.FLAG_TURN_SCREEN_ON);
        setContentView(R.layout.main);
        iceServers.add(new PeerConnection.IceServer("stun:23.21.150.121"));
        iceServers.add(new PeerConnection.IceServer("stun:stun.l.google.com:19302"));
        pcConstraints = new MediaConstraints();
        pcConstraints.optional.add(new MediaConstraints.KeyValuePair("DtlsSrtpKeyAgreement", "true"));
        PeerConnectionFactory.initializeAndroidGlobals(this, true, false,
                false, null);
        pc = new PeerConnectionFactory().createPeerConnection(iceServers, pcConstraints, this);
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE_TYPES);
        integrator.setPrompt("Scan a QR code from the website");
        integrator.initiateScan();
    }

    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult scanResult = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (scanResult != null) {
            // handle scan result
            String content = scanResult.getContents();
            if (content == null) {
                Toast.makeText(this, "Problem getting scan result", Toast.LENGTH_LONG).show();
            } else {
                String[] parts = content.split("\\|", 2);
                beginWebrtc(parts[0], parts[1]);
            }
        } else {
            Toast.makeText(this, "Problem scanning qr code", Toast.LENGTH_LONG).show();
        }
    }

    private void beginWebrtc(String server, String key) {
        this.server = server;
        this.key = key;
        get(server + key, new Callback() {
            @Override
            public void callback(final String offer) {
                pc.setRemoteDescription(new SdpObserver() {
                    @Override
                    public void onCreateSuccess(SessionDescription sessionDescription) {
                    }

                    @Override
                    public void onSetSuccess() {
                        pc.createAnswer(new SdpObserver() {
                            @Override
                            public void onCreateSuccess(SessionDescription answer) {
                                pc.setLocalDescription(new SdpObserver() {
                                    @Override
                                    public void onCreateSuccess(SessionDescription sessionDescription) {
                                    }

                                    @Override
                                    public void onSetSuccess() {
                                    }

                                    @Override
                                    public void onCreateFailure(String s) {
                                    }

                                    @Override
                                    public void onSetFailure(String s) {
                                    }
                                }, answer);
                            }

                            @Override
                            public void onSetSuccess() {
                            }

                            @Override
                            public void onCreateFailure(String s) {
                            }

                            @Override
                            public void onSetFailure(String s) {
                            }
                        }, pcConstraints);
                    }

                    @Override
                    public void onCreateFailure(String s) {
                    }

                    @Override
                    public void onSetFailure(String s) {
                    }
                }, deserializeRTCDesc(offer));
            }
        });
    }

    private interface Callback {
        void callback(String data);
    }

    private SessionDescription deserializeRTCDesc(String data) {
        try {
            JSONObject payload = new JSONObject(data);
            return new SessionDescription(
                    SessionDescription.Type.fromCanonicalForm(payload.getString("type")),
                    payload.getString("sdp")
            );
        } catch (JSONException e) {
            handleError(e);
        }
        return null;
    }

    private String serializeRTCDesc(SessionDescription sdp) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", sdp.type.canonicalForm());
            payload.put("sdp", sdp.description);
            return payload.toString();
        } catch (JSONException e) {
            handleError(e);
        }
        return null;
    }

    @Override
    public void onSignalingChange(PeerConnection.SignalingState signalingState) {

    }

    @Override
    public void onIceConnectionChange(PeerConnection.IceConnectionState iceConnectionState) {

    }

    @Override
    public void onIceGatheringChange(PeerConnection.IceGatheringState iceGatheringState) {
        if (iceGatheringState != PeerConnection.IceGatheringState.COMPLETE) return;
        post(server + key, serializeRTCDesc(pc.getLocalDescription()), new Callback() {
            @Override
            public void callback(String data) {
                System.out.println("out:" + data);
            }
        });
    }

    private void get(final String urlStr, final Callback c) {
        new Thread(new Runnable() {
            public void run() {
                System.out.println("GET:" + urlStr);
                URL url = null;
                try {
                    url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    String result = "", line;
                    BufferedReader rd = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    while ((line = rd.readLine()) != null) {
                        result += line;
                    }
                    rd.close();
                    c.callback(result);
                } catch (MalformedURLException e) {
                    handleError(e);
                } catch (IOException e) {
                    handleError(e);
                }
            }
        }).start();
    }

    void handleError(final Exception e) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(RtcConnectActivity.this.getApplicationContext(), e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
        e.printStackTrace();
    }

    private void post(final String urlStr, final String data, final Callback c) {
        new Thread(new Runnable() {
            public void run() {
                System.out.println("POST:" + urlStr);
                URL url = null;
                try {
                    url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setDoOutput(true);
                    DataOutputStream out = new DataOutputStream(conn.getOutputStream());
                    out.writeBytes(data);
                    out.close();
                    String result = "", line;
                    BufferedReader rd = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    while ((line = rd.readLine()) != null) {
                        result += line;
                    }
                    rd.close();
                    c.callback(result);
                } catch (MalformedURLException e) {
                    handleError(e);

                } catch (IOException e) {
                    handleError(e);
                }
            }
        }).start();
    }

    @Override
    public void onIceCandidate(IceCandidate iceCandidate) {

    }

    @Override
    public void onAddStream(MediaStream mediaStream) {

    }

    @Override
    public void onRemoveStream(MediaStream mediaStream) {

    }

    @Override
    public void onDataChannel(DataChannel dataChannel) {
        dataChannel.registerObserver(new DataChannel.Observer() {
            @Override
            public void onStateChange() {

            }

            @Override
            public void onMessage(DataChannel.Buffer buffer) {
                byte[] b = new byte[buffer.data.remaining()];
                buffer.data.get(b);
                System.out.println("received " + new String(b));
            }
        });
        PenSyncActivity.channel = dataChannel;
        startActivity(new Intent(this, PenSyncActivity.class));
        finish();
    }

    @Override
    public void onRenegotiationNeeded() {

    }
}