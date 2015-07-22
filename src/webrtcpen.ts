if (navigator.mozGetUserMedia) {
	RTCPeerConnection = mozRTCPeerConnection;
	RTCSessionDescription = mozRTCSessionDescription;
	RTCIceCandidate = mozRTCIceCandidate;
} else if (navigator.webkitGetUserMedia) {
	RTCPeerConnection = webkitRTCPeerConnection;
}

module WebRTCPen {
	export let info: PenInformation = <any>{};
	export let penSize = 20;
	let config: Configuration;
	// from https://developer.android.com/reference/android/view/MotionEvent.html
	enum ToolType {
		unknown, finger, stylus, mouse, eraser
	}
	enum Action {
		Down, Up, Move2,
		Cancel, Outside,
		Pointer_Down, Pointer_Up,
		Hover_Move, Scroll,
		Hover_Enter, Hover_Exit
	}
	interface PenInformation {
		x: number, y: number, action: Action, event: string, pressure: number, tooltype: ToolType
	}
	interface Configuration {
		server: string; // the nodejs server that handles the sessions
		emulateMouse?: boolean; // send mouse events to the DOM
	}
	let moveDiv = $("<div>").css({ position: 'absolute', borderRadius: '100%', display: 'none', zIndex: 99 });
	function onConnectionInit() {
		moveDiv.appendTo($("body"));
	}
	function onMessage(msg: string) {
		info = JSON.parse(msg);
		document.dispatchEvent(new CustomEvent("webrtcpen", { detail: info }));
		if (config.emulateMouse) emulateMouse(info);
		let color = info.tooltype == ToolType.finger ? 'red' : 'green';
		let size = info.pressure * penSize;
		if (info.event != 'touch') {
			color = 'black';
			size = penSize / 2;
		}
		moveDiv.css({
			display: info.action == Action.Hover_Exit || info.action == Action.Up ? 'none' : 'inherit',
			top: info.y - size / 2, left: info.x - size / 2,
			background: color, width: size, height: size
		});
	}
	export function initialize(_config: Configuration) {
		config = _config;
		if (config.server[config.server.length - 1] != '/') config.server += '/';
		// wait for document ready
		$(() => RTC.pc1(config.server, onConnectionInit.bind(WebRTCPen), onMessage.bind(WebRTCPen)));
	}
	let lastEle: Node = null;
	function emulateMouse(info: PenInformation) {
		var type = ["mousedown", "mouseup", "mousemove", "mouseup", "mouseup", , , "mousemove", , , ][info.action];
		if (type) {
			let ele = (document.elementFromPoint(info.x, info.y) || document);
			let evt = {
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
}
module WebRTCPen.RTC {
	export let pc: RTCPeerConnection, channel: RTCDataChannel;
	declare var QRCode: any; // qr drawing lib
	let cfg = { iceServers: [{ url: "stun:23.21.150.121" }, { url: "stun:stun.l.google.com:19302" }] };
	let con = { optional: [{ DtlsSrtpKeyAgreement: true }] };
	let qrsize = 300;
	function succ(...x: any[]) {
		console.log("success", arguments, succ.caller);
	}
	function fail(e?: any, m?: any) {
		$(".container,body").eq(0).append($("<div class='alert alert-danger'>").text("error: " + m + ":" + e.status));
		console.error("failure", arguments, succ.caller);
	}
	//pc.onicecandidate = ev => !ev.candidate || pc.addIceCandidate(ev.candidate, succ, fail);
	function serializeRTCDesc(desc: RTCSessionDescription) {
		return JSON.stringify(desc);
	}
	function deserializeRTCDesc(desc: string|any) {
		if (typeof desc === 'string') desc = JSON.parse(desc);
		return new RTCSessionDescription(desc);
	}
	function whenIceDone(callback: () => void) {
		// todo: is this a hack?
		pc.onicecandidate = ev => { if (ev.candidate == null) callback(); }
	}
	function addSpinner() {
		// css animation
		$("<style>@keyframes rotateplane{0%{transform:perspective(120px) rotateX(0) rotateY(0)}50%{transform:perspective(120px) rotateX(-180.1deg) rotateY(0)}1ü00%{transform:perspective(120px) rotateX(-180deg) rotateY(-179.9deg)}}</style>")
			.appendTo("head");
		return $("<div style='width:100px;height:100px;background-color:#333;animation:rotateplane 1.2s infinite ease-in-out'>")
			.appendTo("body").css({ position: 'absolute', top: $(document).height() / 2 - 50, left: $(document).width() / 2 - 50 });
	}

	export function pc1(server: string, onConnectionInit: () => void, onMessage: (s: string) => void) {
		let qr = addSpinner();
		pc = new RTCPeerConnection(cfg, con);
		channel = pc.createDataChannel('test', { maxRetransmits: 0/*reliable: true*/ });
		channel.onopen = evt => {
			console.log("chanel open");
			channel.send('sending');
			onConnectionInit();
		}
		channel.onmessage = msg => onMessage(msg.data);
		pc.createOffer(offer => {
			pc.setLocalDescription(offer, () => {
				pc.oniceconnectionstatechange = e => console.log('cosc', pc.iceConnectionState);
				whenIceDone(() => {
					$.post(server, serializeRTCDesc(pc.localDescription)).then(key => {
						qr.removeAttr('style').css({ position: 'absolute', top: $(document).height() / 2 - qrsize / 2, left: $(document).width() / 2 - qrsize / 2 });
						new QRCode(qr[0], {
							text: server + key,
							width: qrsize, height: qrsize
						});
						return $.get(server + key);
					}).then(deserializeRTCDesc).then(answer => {
						qr.remove();
						pc.setRemoteDescription(answer, succ, fail);
					}).fail(fail);
				});
			}, fail);
		}, fail);
	}
	
	// this is what the client (android) does for connecting
	export function pc2(server: string, key: string) {
		pc = new RTCPeerConnection(cfg, con);
		pc.ondatachannel = (event: RTCDataChannelEvent) => channel = event.channel;
		$.getJSON(server + key).then(deserializeRTCDesc).then(offer => {
			pc.setRemoteDescription(offer, succ, fail);
			pc.createAnswer(answer => {
				pc.setLocalDescription(answer, () => {
					whenIceDone(() => $.post(server + key, serializeRTCDesc(pc.localDescription)).then(succ));
				}, fail);
			}, fail);
		}).fail(fail);
	}
}
