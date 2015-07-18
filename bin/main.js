var server = "http://" + location.host.split(':')[0] + ":3001/";
if (navigator.mozGetUserMedia) {
    RTCPeerConnection = mozRTCPeerConnection;
    RTCSessionDescription = mozRTCSessionDescription;
    RTCIceCandidate = mozRTCIceCandidate;
}
else if (navigator.webkitGetUserMedia) {
    RTCPeerConnection = webkitRTCPeerConnection;
}
var Pen;
(function (Pen) {
    Pen.info = {};
    Pen.penSize = 20;
    // from https://developer.android.com/reference/android/view/MotionEvent.html
    var ToolType;
    (function (ToolType) {
        ToolType[ToolType["unknown"] = 0] = "unknown";
        ToolType[ToolType["finger"] = 1] = "finger";
        ToolType[ToolType["stylus"] = 2] = "stylus";
        ToolType[ToolType["mouse"] = 3] = "mouse";
        ToolType[ToolType["eraser"] = 4] = "eraser";
    })(ToolType || (ToolType = {}));
    var Action;
    (function (Action) {
        Action[Action["Down"] = 0] = "Down";
        Action[Action["Up"] = 1] = "Up";
        Action[Action["Move"] = 2] = "Move";
        Action[Action["Cancel"] = 3] = "Cancel";
        Action[Action["Outside"] = 4] = "Outside";
        Action[Action["Pointer_Down"] = 5] = "Pointer_Down";
        Action[Action["Pointer_Up"] = 6] = "Pointer_Up";
        Action[Action["Hover_Move"] = 7] = "Hover_Move";
        Action[Action["Scroll"] = 8] = "Scroll";
        Action[Action["Hover_Enter"] = 9] = "Hover_Enter";
        Action[Action["Hover_Exit"] = 10] = "Hover_Exit";
    })(Action || (Action = {}));
    var moveDiv = $("<div style='position:absolute; width:100px; height:100px; top:0; left:0; background:black; border-radius: 100%'>");
    function onConnectionInit() {
        moveDiv.appendTo($("body"));
    }
    Pen.onConnectionInit = onConnectionInit;
    function onMessage(msg) {
        var data = JSON.parse(msg);
        Pen.info = data;
        document.dispatchEvent(new CustomEvent("androidpen", { detail: Pen.info }));
        var color = data.tooltype == ToolType.finger ? 'red' : 'green';
        var size = data.pressure * Pen.penSize;
        if (data.event == 'touch') {
        }
        else {
            color = 'black';
            size = Pen.penSize / 2;
        }
        moveDiv.css({ top: data.y - size / 2, left: data.x - size / 2, background: color, width: size, height: size });
    }
    Pen.onMessage = onMessage;
})(Pen || (Pen = {}));
var RTC;
(function (RTC) {
    RTC.pc;
    RTC.channel;
    var cfg = { iceServers: [{ url: "stun:23.21.150.121" }] };
    var con = { optional: [{ DtlsSrtpKeyAgreement: true }] };
    var qrsize = 300;
    function succ() {
        var x = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            x[_i - 0] = arguments[_i];
        }
        console.log("success", arguments, succ.caller);
    }
    function fail(e, m) {
        $(".container").append($("<div class='alert alert-danger'>").text("error: " + m + ":" + e.status));
        console.error("failure", arguments, succ.caller);
    }
    //pc.onicecandidate = ev => !ev.candidate || pc.addIceCandidate(ev.candidate, succ, fail);
    function serializeRTCDesc(desc) {
        return JSON.stringify(desc);
    }
    function deserializeRTCDesc(desc) {
        if (typeof desc === 'string')
            desc = JSON.parse(desc);
        return new RTCSessionDescription(desc);
    }
    function whenIceDone(callback) {
        // todo: this a hack?
        RTC.pc.onicecandidate = function (ev) { if (ev.candidate == null)
            callback(); };
    }
    function pc1(server, onConnectionInit, onMessage) {
        RTC.pc = new RTCPeerConnection(cfg, con);
        RTC.channel = RTC.pc.createDataChannel('test', { maxRetransmits: 0 /*reliable: true*/ });
        RTC.channel.onopen = function (evt) {
            console.log("chanel open");
            RTC.channel.send('sending');
            onConnectionInit();
        };
        RTC.channel.onmessage = function (msg) { return onMessage(msg.data); };
        RTC.pc.createOffer(function (offer) {
            RTC.pc.setLocalDescription(offer, function () {
                RTC.pc.oniceconnectionstatechange = function (e) { return console.log('cosc', RTC.pc.iceConnectionState); };
                whenIceDone(function () {
                    $.post(server, serializeRTCDesc(RTC.pc.localDescription)).then(function (key) {
                        console.log("localhost:8000/?" + key);
                        var qr = $("qrcode");
                        qr.css({ position: 'absolute', top: $(document).height() / 2 - qrsize / 2, left: $(document).width() / 2 - qrsize / 2 });
                        new QRCode(qr[0], {
                            text: server + "|" + key,
                            width: qrsize,
                            height: qrsize
                        });
                        return $.get(server + key);
                    }).then(deserializeRTCDesc).then(function (answer) {
                        $("qrcode").remove();
                        RTC.pc.setRemoteDescription(answer, succ, fail);
                    }).fail(fail);
                });
            }, fail);
        }, fail);
    }
    RTC.pc1 = pc1;
    function pc2(server, key) {
        RTC.pc = new RTCPeerConnection(cfg, con);
        // this is what the client (android) does
        RTC.pc.ondatachannel = function (event) { return RTC.channel = event.channel; };
        $.getJSON(server + key).then(deserializeRTCDesc).then(function (offer) {
            RTC.pc.setRemoteDescription(offer, succ, fail);
            RTC.pc.createAnswer(function (answer) {
                RTC.pc.setLocalDescription(answer, function () {
                    whenIceDone(function () { return $.post(server + key, serializeRTCDesc(RTC.pc.localDescription)).then(succ); });
                }, fail);
            }, fail);
        }).fail(fail);
    }
    RTC.pc2 = pc2;
})(RTC || (RTC = {}));
if (location.search)
    RTC.pc2(server, location.search.substr(1));
else
    RTC.pc1(server, Pen.onConnectionInit.bind(Pen), Pen.onMessage.bind(Pen));
//# sourceMappingURL=main.js.map