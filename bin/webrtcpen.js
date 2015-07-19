if (navigator.mozGetUserMedia) {
    RTCPeerConnection = mozRTCPeerConnection;
    RTCSessionDescription = mozRTCSessionDescription;
    RTCIceCandidate = mozRTCIceCandidate;
}
else if (navigator.webkitGetUserMedia) {
    RTCPeerConnection = webkitRTCPeerConnection;
}
var WebRTCPen;
(function (WebRTCPen) {
    WebRTCPen.info = {};
    WebRTCPen.penSize = 20;
    var config;
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
    var moveDiv = $("<div>").css({ position: 'absolute', borderRadius: '100%', display: 'none', zIndex: 99 });
    function onConnectionInit() {
        moveDiv.appendTo($("body"));
    }
    function onMessage(msg) {
        WebRTCPen.info = JSON.parse(msg);
        document.dispatchEvent(new CustomEvent("webrtcpen", { detail: WebRTCPen.info }));
        if (config.emulateMouse)
            emulateMouse(WebRTCPen.info);
        var color = WebRTCPen.info.tooltype == ToolType.finger ? 'red' : 'green';
        var size = WebRTCPen.info.pressure * WebRTCPen.penSize;
        if (WebRTCPen.info.event == 'touch') {
        }
        else {
            color = 'black';
            size = WebRTCPen.penSize / 2;
        }
        moveDiv.css({
            display: WebRTCPen.info.action == Action.Hover_Exit || WebRTCPen.info.action == Action.Up ? 'none' : 'inherit',
            top: WebRTCPen.info.y - size / 2, left: WebRTCPen.info.x - size / 2,
            background: color, width: size, height: size
        });
    }
    function initialize(_config) {
        config = _config;
        WebRTCPen.RTC.pc1(config.server, onConnectionInit.bind(WebRTCPen), onMessage.bind(WebRTCPen));
    }
    WebRTCPen.initialize = initialize;
    var lastEle = null;
    function emulateMouse(info) {
        var type = ["mousedown", "mouseup", "mousemove", "mouseup", "mouseup", , , "mousemove", , ,][info.action];
        if (type) {
            var ele = (document.elementFromPoint(info.x, info.y) || document);
            var evt = {
                screenX: window.screenX + info.x,
                screenY: window.screenY + info.y,
                clientX: info.x,
                clientY: info.y,
                bubbles: true,
                cancelable: true,
                view: window
            };
            ele.dispatchEvent(new MouseEvent(type, evt));
            if (type === 'mouseup' && ele === lastEle)
                ele.dispatchEvent(new MouseEvent('click', evt));
            lastEle = ele;
        }
    }
})(WebRTCPen || (WebRTCPen = {}));
var WebRTCPen;
(function (WebRTCPen) {
    var RTC;
    (function (RTC) {
        RTC.pc;
        RTC.channel;
        var cfg = { iceServers: [{ url: "stun:23.21.150.121" }, { url: "stun:stun.l.google.com:19302" }] };
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
            $(".container,body").eq(0).append($("<div class='alert alert-danger'>").text("error: " + m + ":" + e.status));
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
                        var qr = $("<div>");
                        $.post(server, serializeRTCDesc(RTC.pc.localDescription)).then(function (key) {
                            qr.appendTo("body")
                                .css({ position: 'absolute', top: $(document).height() / 2 - qrsize / 2, left: $(document).width() / 2 - qrsize / 2 });
                            new QRCode(qr[0], {
                                text: server + "|" + key,
                                width: qrsize,
                                height: qrsize
                            });
                            return $.get(server + key);
                        }).then(deserializeRTCDesc).then(function (answer) {
                            qr.remove();
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
    })(RTC = WebRTCPen.RTC || (WebRTCPen.RTC = {}));
})(WebRTCPen || (WebRTCPen = {}));
//# sourceMappingURL=webrtcpen.js.map