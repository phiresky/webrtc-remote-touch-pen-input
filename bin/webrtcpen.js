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
        if (WebRTCPen.info.event != 'touch') {
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
        if (config.server[config.server.length - 1] != '/')
            config.server += '/';
        // wait for document ready
        $(function () { return WebRTCPen.RTC.pc1(config.server, onConnectionInit.bind(WebRTCPen), onMessage.bind(WebRTCPen)); });
    }
    WebRTCPen.initialize = initialize;
    var lastEle = null;
    function emulateMouse(info) {
        var type = ["mousedown", "mouseup", "mousemove", "mouseup", "mouseup", , , "mousemove", , ,][info.action];
        if (type) {
            var ele = (document.elementFromPoint(info.x, info.y) || document);
            var evt = {
                screenX: window.screenX + info.x, screenY: window.screenY + info.y,
                clientX: info.x, clientY: info.y,
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
        RTC.pc, RTC.channel;
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
            // todo: is this a hack?
            RTC.pc.onicecandidate = function (ev) { if (ev.candidate == null)
                callback(); };
        }
        function addSpinner() {
            // css animation
            $("<style>@keyframes rotateplane{0%{transform:perspective(120px) rotateX(0) rotateY(0)}50%{transform:perspective(120px) rotateX(-180.1deg) rotateY(0)}1ü00%{transform:perspective(120px) rotateX(-180deg) rotateY(-179.9deg)}}</style>")
                .appendTo("head");
            return $("<div style='width:100px;height:100px;background-color:#333;animation:rotateplane 1.2s infinite ease-in-out'>")
                .appendTo("body").css({ position: 'absolute', top: $(document).height() / 2 - 50, left: $(document).width() / 2 - 50 });
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
                                text: server + key,
                                width: qrsize, height: qrsize
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
        // this is what the client (android) does for connecting
        function pc2(server, key) {
            RTC.pc = new RTCPeerConnection(cfg, con);
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
// adapted from https://github.com/shspage/paperjs-pressure-pdfout
var PenDrawing;
(function (PenDrawing) {
    var project;
    var tools;
    var stroke_color = "#000000";
    var pressure_factor = 4;
    var min_dist_squared = 4 * 4;
    function initialize(canvas) {
        paper.setup(canvas);
        $("#color_change").change(function (evt) { return stroke_color = evt.target.value; });
        project = paper.project;
        tools = [new Brush(), new Pencil(), new Mover(), new Eraser()];
    }
    PenDrawing.initialize = initialize;
    var UndoRedo;
    (function (UndoRedo) {
        var DeleteItem = (function () {
            function DeleteItem(itm) {
                this.itm = itm;
            }
            DeleteItem.prototype.perform = function (is_undo) {
                for (var _i = 0, _a = this.itm; _i < _a.length; _i++) {
                    var i = _a[_i];
                    if (i)
                        i.visible = !i.visible;
                }
            };
            return DeleteItem;
        })();
        UndoRedo.DeleteItem = DeleteItem;
        var ModifyItem = (function () {
            function ModifyItem(itm, offset) {
                this.itm = itm;
                this.offset = offset;
            }
            ModifyItem.prototype.perform = function (is_undo) {
                this.itm.translate(is_undo ? this.offset.multiply(-1) : this.offset);
            };
            return ModifyItem;
        })();
        UndoRedo.ModifyItem = ModifyItem;
        var UndoRedoSystem = (function () {
            function UndoRedoSystem(limit) {
                if (limit === void 0) { limit = 200; }
                this.limit = limit;
                this.undoArray = [];
                this.redoArray = [];
            }
            UndoRedoSystem.prototype.limitUndo = function () {
                if (this.limit > 0)
                    while (this.undoArray.length > this.limit)
                        this.undoArray.shift();
            };
            UndoRedoSystem.prototype.undo = function () {
                if (this.undoArray.length > 0) {
                    var arr = this.undoArray.pop();
                    arr.perform(true);
                    this.redoArray.push(arr);
                }
            };
            UndoRedoSystem.prototype.redo = function () {
                if (this.redoArray.length > 0) {
                    var arr = this.redoArray.pop();
                    arr.perform(false);
                    this.undoArray.push(arr);
                    this.limitUndo();
                }
            };
            UndoRedoSystem.prototype.append = function (item) {
                this.undoArray.push(item);
                this.limitUndo();
                this.clear(this.redoArray);
            };
            UndoRedoSystem.prototype.clearAll = function () {
                this.clear(this.undoArray);
                this.clear(this.redoArray);
            };
            UndoRedoSystem.prototype.clear = function (r) {
                var arr;
                while (r.length > 0) {
                    arr = r.shift();
                    var items = arr instanceof DeleteItem ? arr.itm
                        : arr instanceof ModifyItem ? [arr.itm] : [];
                    for (var _i = 0; _i < items.length; _i++) {
                        var i = items[_i];
                        if (i && !i.visible)
                            i.remove();
                    }
                }
            };
            return UndoRedoSystem;
        })();
        UndoRedo.UndoRedoSystem = UndoRedoSystem;
    })(UndoRedo || (UndoRedo = {}));
    var undoRedo = new UndoRedo.UndoRedoSystem();
    function downloadSVG() {
        var out = paper.project.exportSVG({ asString: true });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([out], { type: "text/calendar" }));
        var date = new Date().toISOString().replace(/T/, " ").replace(/:/g, '.').substr(0, 19);
        a.download = "Drawing " + date + ".svg";
        a.click();
    }
    PenDrawing.downloadSVG = downloadSVG;
    function clearCanvas() {
        paper.project.clear();
        undoRedo.clearAll();
    }
    PenDrawing.clearCanvas = clearCanvas;
    var path;
    var myLastPoint;
    var NamedTool = (function (_super) {
        __extends(NamedTool, _super);
        function NamedTool(name, desc) {
            _super.call(this);
            this.name = name;
            this.desc = desc;
            this.onKeyDown = function (event) {
                switch (event.character) {
                    case "1":
                        addToStrokeWidthValue(-1);
                        break;
                    case "2":
                        addToStrokeWidthValue(1);
                        break;
                    case "z":
                        undoRedo.undo();
                        break;
                    case "Z":
                        undoRedo.redo();
                        break;
                    case "E":
                        clearLayer();
                        break;
                    case "e":
                        changeTool(Eraser);
                        break;
                    case "b":
                        changeTool(Brush);
                        break;
                    case "m":
                        changeTool(Mover);
                        break;
                    case "n":
                        changeTool(Pencil);
                        break;
                    case "t":
                        toggleDraft();
                        break;
                }
            };
        }
        return NamedTool;
    })(paper.Tool);
    var Brush = (function (_super) {
        __extends(Brush, _super);
        function Brush() {
            _super.call(this, "brush", "drag to draw");
            this.maxDistance = 8;
            this.onMouseDown = function (event) {
                myLastPoint = event.point;
            };
            this.onMouseDrag = function (event) {
                if (event.point.getDistance(myLastPoint, true) > min_dist_squared) {
                    if (!path) {
                        path = new paper.Path();
                        path.fillColor = stroke_color;
                        path.closed = true;
                        path.add(myLastPoint);
                    }
                    else {
                        path.lastSegment.remove();
                    }
                    var pressure = WebRTCPen.info.pressure || 1.0;
                    var v = event.point.subtract(myLastPoint).divide(2);
                    var vp = v.normalize().multiply(pressure).multiply(pressure_factor);
                    vp.angle = vp.angle + 90;
                    path.add(myLastPoint.add(v).add(vp));
                    path.insert(0, myLastPoint.add(v).subtract(vp));
                    path.add(event.point);
                    path.smooth();
                    myLastPoint = event.point;
                }
            };
            this.onMouseUp = function (event) {
                if (path) {
                    if (path.segments.length < 2) {
                        path.remove();
                    }
                    else {
                        path.simplify();
                        undoRedo.append(new UndoRedo.DeleteItem([path]));
                    }
                    path = null;
                }
            };
        }
        return Brush;
    })(NamedTool);
    var Pencil = (function (_super) {
        __extends(Pencil, _super);
        function Pencil() {
            _super.call(this);
            this.maxDistance = 8;
            this.onMouseDrag = function (event) {
                if (event.point.getDistance(myLastPoint, true) > min_dist_squared) {
                    if (!path) {
                        path = new paper.Path();
                        path.strokeColor = stroke_color;
                        path.closed = false;
                        path.strokeWidth = +pressure_factor;
                        path.add(myLastPoint);
                    }
                    path.add(event.point);
                    path.smooth();
                    myLastPoint = event.point;
                }
            };
            this.name = 'pencil';
        }
        return Pencil;
    })(Brush);
    var Mover = (function (_super) {
        __extends(Mover, _super);
        function Mover() {
            var _this = this;
            _super.call(this, "mover", "drag to move");
            this.maxDistance = 8;
            this.onMouseDown = function (event) {
                for (var _i = 0, _a = project.selectedItems; _i < _a.length; _i++) {
                    var itm = _a[_i];
                    itm.selected = false;
                }
                var result = project.hitTest(event.point);
                if (result && result.item) {
                    result.item.selected = true;
                    _this.target = result.item;
                    myLastPoint = event.point;
                }
                else {
                    _this.target = null;
                }
            };
            this.onMouseDrag = function (event) {
                if (_this.target) {
                    _this.target.translate(event.point.subtract(myLastPoint));
                    myLastPoint = event.point;
                }
            };
            this.onMouseUp = function (event) {
                if (_this.target) {
                    undoRedo.append(new UndoRedo.ModifyItem(_this.target, event.delta));
                    _this.target.selected = false;
                    _this.target = null;
                }
            };
        }
        return Mover;
    })(NamedTool);
    var Eraser = (function (_super) {
        __extends(Eraser, _super);
        function Eraser() {
            _super.call(this, "eraser", "CLICK to erase");
            this.maxDistance = 8;
            this.onMouseDown = function (event) {
                var result = project.hitTest(event.point);
                if (result && result.item) {
                    result.item.visible = false;
                    undoRedo.append(new UndoRedo.DeleteItem([result.item]));
                }
            };
        }
        return Eraser;
    })(NamedTool);
    function clearLayer() {
        var r = [];
        for (var _i = 0, _a = project.activeLayer.children; _i < _a.length; _i++) {
            var i = _a[_i];
            if (i.visible) {
                i.visible = false;
                r.push(i);
            }
        }
        undoRedo.append(new UndoRedo.DeleteItem(r));
    }
    function toggleDraft() {
        if (project.layers.length < 2) {
            new paper.Layer();
        }
        else {
            project.layers[0].moveAbove(project.layers[1]);
        }
        project.layers[0].opacity = 0.1;
        project.layers[1].opacity = 1.0;
        project.activeLayer = project.layers[1];
    }
    function changeTool(tool_class) {
        var tool = tools.filter(function (tool) { return tool instanceof tool_class; })[0];
        $('#current_tool').text(tool.name);
        $('#tool_description').text(tool.desc);
        tool.activate();
    }
    function addToStrokeWidthValue(n) {
        if (pressure_factor > 1 && pressure_factor < 20)
            $('#pressureFactorValue').text(pressure_factor += n);
    }
})(PenDrawing || (PenDrawing = {}));
//# sourceMappingURL=webrtcpen.js.map