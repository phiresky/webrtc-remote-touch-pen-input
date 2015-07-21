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
        $(function () {
            return WebRTCPen.RTC.pc1(config.server, onConnectionInit.bind(WebRTCPen), onMessage.bind(WebRTCPen));
        });
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
        function addSpinner() {
            $("<style>@keyframes rotateplane{0%{transform:perspective(120px) rotateX(0) rotateY(0)}50%{transform:perspective(120px) rotateX(-180.1deg) rotateY(0)}100%{transform:perspective(120px) rotateX(-180deg) rotateY(-179.9deg)}}</style>").appendTo("head");
            var qr = $("<div style='width:100px;height:100px;background-color:#333;animation:rotateplane 1.2s infinite ease-in-out'>");
            qr.appendTo("body").css({ position: 'absolute', top: $(document).height() / 2 - 50, left: $(document).width() / 2 - 50 });
            return qr;
        }
        function pc1(server, onConnectionInit, onMessage) {
            var qr = addSpinner();
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
                            qr.removeAttr('style').css({ position: 'absolute', top: $(document).height() / 2 - qrsize / 2, left: $(document).width() / 2 - qrsize / 2 });
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
            // this is what the client (android) does for connecting
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
// adapted from https://github.com/shspage/paperjs-pressure-pdfout
var PenDrawing;
(function (PenDrawing) {
    var project;
    function initialize(canvas) {
        paper.setup(canvas);
        project = paper.project;
        paper.tool = new paper.Tool();
        paper.tool.maxDistance = 8;
        paper.tool.onMouseDown = onMouseDown;
        paper.tool.onMouseUp = onMouseUp;
        paper.tool.onKeyDown = onKeyDown;
        paper.tool.onMouseDrag = onMouseDrag;
    }
    PenDrawing.initialize = initialize;
    var kUndoLimit = 200;
    var UndoRedoSystemArray = (function () {
        function UndoRedoSystemArray(name) {
            this.name = name;
            this.r = [];
            this.name = name;
        }
        UndoRedoSystemArray.prototype.clear = function () {
            var arr, typ, itm;
            while (this.r.length > 0) {
                arr = this.r.shift();
                typ = arr[0];
                itm = arr[1];
                if (typ == "dd") {
                    if (itm) {
                        for (var i = 0; i < itm.length; i++) {
                            if (itm[i] && !itm[i].visible) {
                                itm[i].remove();
                                itm[i] = null;
                            }
                        }
                    }
                }
                else {
                    if (itm && !itm.visible) {
                        itm.remove();
                        itm = null;
                    }
                }
            }
        };
        UndoRedoSystemArray.prototype.store = function (arr) {
            this.r.push(arr);
            if (kUndoLimit > 0 && this.name == "undo") {
                while (this.r.length > kUndoLimit) {
                    this.r.shift();
                }
            }
        };
        return UndoRedoSystemArray;
    })();
    ;
    var UndoRedoSystem = (function () {
        function UndoRedoSystem() {
            this.undoArray = new UndoRedoSystemArray("undo");
            this.redoArray = new UndoRedoSystemArray("redo");
        }
        UndoRedoSystem.prototype._perform = function (arr, is_undo) {
            var itm = arr[1];
            if (arr[0] == "d") {
                if (itm)
                    itm.visible = !itm.visible;
            }
            else if (arr[0] == "dd") {
                for (var _i = 0; _i < itm.length; _i++) {
                    var i = itm[_i];
                    if (i)
                        i.visible = !i.visible;
                }
            }
            else if (arr[0] == "m") {
                itm.translate(is_undo ? arr[2] : arr[3]);
            }
        };
        UndoRedoSystem.prototype.undo = function () {
            if (this.undoArray.r.length > 0) {
                var arr = this.undoArray.r.pop();
                this._perform(arr, true);
                this.redoArray.store(arr);
            }
        };
        UndoRedoSystem.prototype.redo = function () {
            if (this.redoArray.r.length > 0) {
                var arr = this.redoArray.r.pop();
                this._perform(arr, false);
                this.undoArray.store(arr);
            }
        };
        UndoRedoSystem.prototype.append = function (arr) {
            this.undoArray.store(arr);
            this.redoArray.clear();
        };
        UndoRedoSystem.prototype.clearAll = function () {
            this.undoArray.clear();
            this.redoArray.clear();
        };
        return UndoRedoSystem;
    })();
    var undoRedo = new UndoRedoSystem();
    window.undoRedo = undoRedo;
    function downloadSVG() {
        var out = paper.project.exportSVG({ asString: true });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([out], { type: "text/calendar" }));
        var date = new Date().toISOString().replace(/T/, " ").replace(/:/g, '.').substr(0, 19);
        a.download = "Drawing " + date + ".svg";
        a.click();
    }
    function clearCanvas(canvas_name) {
        paper.project.clear();
        undoRedo.clearAll();
    }
    var path;
    var myLastPoint;
    var opt = {
        tool_name: "brush",
        stroke_color: "#000000",
        pressure_factor: 8,
        min_dist_squared: 4 * 4,
        target_item: null,
        tool_desc: {
            "brush": "drag to draw",
            "eraser": "CLICK to erase",
            "mover": "drag to move",
            "pencil": "drag to draw" }
    };
    function onMouseDown(event) {
        if (opt.tool_name == "brush" || opt.tool_name == "pencil") {
            myLastPoint = event.point;
        }
        else if (opt.tool_name == "mover") {
            for (var i = 0; i < project.selectedItems.length; i++) {
                project.selectedItems[i].selected = false;
            }
            var result = project.hitTest(event.point);
            if (result && result.item) {
                result.item.selected = true;
                opt.target_item = result.item;
                myLastPoint = event.point;
            }
            else {
                opt.target_item = null;
            }
        }
        else if (opt.tool_name == "eraser") {
            var result = project.hitTest(event.point);
            if (result && result.item) {
                result.item.visible = false;
                undoRedo.append(["d", result.item]);
            }
        }
    }
    function onMouseDrag(event) {
        if (opt.tool_name == "brush" || opt.tool_name == "pencil") {
            if (event.point.getDistance(myLastPoint, true) > opt.min_dist_squared) {
                if (!path) {
                    path = new paper.Path();
                    if (opt.tool_name == "brush") {
                        path.fillColor = opt.stroke_color;
                        path.closed = true;
                    }
                    else {
                        path.strokeColor = opt.stroke_color;
                        path.closed = false;
                        path.strokeWidth = opt.pressure_factor | 0;
                    }
                    path.add(myLastPoint);
                }
                else {
                    if (opt.tool_name == "brush") {
                        path.lastSegment.remove();
                    }
                }
                if (opt.tool_name == "brush") {
                    var pressure = WebRTCPen.info.pressure || 1.0;
                    var v = event.point.subtract(myLastPoint).divide(2);
                    var vp = v.normalize().multiply(pressure).multiply(opt.pressure_factor);
                    vp.angle = vp.angle + 90;
                    path.add(myLastPoint.add(v).add(vp));
                    path.insert(0, myLastPoint.add(v).subtract(vp));
                }
                path.add(event.point);
                path.smooth();
                myLastPoint = event.point;
            }
        }
        else if (opt.tool_name == "mover") {
            if (opt.target_item) {
                opt.target_item.translate(event.point.subtract(myLastPoint));
                myLastPoint = event.point;
            }
        }
    }
    function onMouseUp(event) {
        if (opt.tool_name == "brush" || opt.tool_name == "pencil") {
            if (path) {
                if (path.segments.length < 2) {
                    path.remove();
                }
                else {
                    path.simplify();
                    undoRedo.append(["d", path]);
                }
                path = null;
            }
        }
        else if (opt.tool_name == "mover") {
            if (opt.target_item) {
                undoRedo.append(["m", opt.target_item,
                    event.delta.multiply(-1), event.delta]);
                opt.target_item.selected = false;
                opt.target_item = null;
            }
        }
    }
    function clearLayer() {
        var r = [];
        var cs = project.activeLayer.children;
        for (var i = 0; i < cs.length; i++) {
            if (cs[i].visible) {
                cs[i].visible = false;
                r.push(cs[i]);
            }
        }
        undoRedo.append(["dd", r]);
    }
    function toggleDraft() {
        if (project.layers.length < 2) {
            new paper.Layer();
        }
        else {
            var lay0 = project.layers[0];
            var lay1 = project.layers[1];
            lay0.moveAbove(lay1);
        }
        project.layers[0].opacity = 0.1;
        project.layers[1].opacity = 1.0;
        project.activeLayer = project.layers[1];
    }
    function changeTool(tool_name) {
        opt.tool_name = tool_name;
        document.getElementById('current_tool').innerHTML = tool_name;
        document.getElementById('tool_description').innerHTML = opt.tool_desc[tool_name];
    }
    function addToStrokeWidthValue(n) {
        if (opt.pressure_factor > 1 && opt.pressure_factor < 20) {
            opt.pressure_factor += n;
            document.getElementById('pressureFactorValue').innerHTML = "" + opt.pressure_factor;
        }
    }
    function onKeyDown(event) {
        switch (event.key) {
            case "1":
                addToStrokeWidthValue(-1);
                break;
            case "2":
                addToStrokeWidthValue(1);
                break;
            case "z":
                if (event.modifiers.shift) {
                    undoRedo.redo();
                    break;
                }
                else {
                    undoRedo.undo();
                    break;
                }
            case "e":
                if (event.modifiers.shift) {
                    clearLayer();
                    break;
                }
                else {
                    changeTool("eraser");
                    break;
                }
            case "b":
                changeTool("brush");
                break;
            case "m":
                changeTool("mover");
                break;
            case "n":
                changeTool("pencil");
                break;
            case "t":
                toggleDraft();
                break;
        }
    }
})(PenDrawing || (PenDrawing = {}));
//# sourceMappingURL=webrtcpen.js.map