declare var QRCode: any;
let server = `http://${location.host.split(':')[0]}:3001/`;

if (navigator.mozGetUserMedia) {
	RTCPeerConnection = mozRTCPeerConnection;
	RTCSessionDescription = mozRTCSessionDescription;
	RTCIceCandidate = mozRTCIceCandidate;
} else if (navigator.webkitGetUserMedia) {
	RTCPeerConnection = webkitRTCPeerConnection;
}

module Pen {
	export let info: info = <any>{};
	export let penSize = 20;
	// from https://developer.android.com/reference/android/view/MotionEvent.html
	enum ToolType {
		unknown, finger, stylus, mouse, eraser
	}
	enum Action {
		Down = 0,
		Up = 1,
		Move = 2,
		Cancel = 3,
		Outside = 4,
		Pointer_Down = 5,
		Pointer_Up = 6,
		Hover_Move = 7,
		Scroll = 8,
		Hover_Enter = 9,
		Hover_Exit = 10,
	}
	interface info {
		x: number, y: number, action: Action, event: string, pressure: number, tooltype: ToolType
	}
	let moveDiv = $("<div style='position:absolute; width:100px; height:100px; top:0; left:0; background:black; border-radius: 100%'>");
	export function onConnectionInit() {
		moveDiv.appendTo($("body"));
	}
	export function onMessage(msg: string) {
		let data: info = JSON.parse(msg);
		info = data;
		document.dispatchEvent(new CustomEvent("androidpen", { detail: info }));
		let color = data.tooltype == ToolType.finger ? 'red' : 'green';
		let size = data.pressure * penSize;
		if (data.event == 'touch') {
		} else {
			color = 'black';
			size = penSize / 2;
		}
		moveDiv.css({ top: data.y - size / 2, left: data.x - size / 2, background: color, width: size, height: size });

	}
}
module RTC {
	export let pc: RTCPeerConnection;
	export let channel: RTCDataChannel;
	let cfg = { iceServers: [{ url: "stun:23.21.150.121" }] };
	let con = { optional: [{ DtlsSrtpKeyAgreement: true }] };
	let qrsize = 300;
	function succ(...x: any[]) {
		console.log("success", arguments, succ.caller);
	}
	function fail(e?, m?) {
		$(".container").append($("<div class='alert alert-danger'>").text("error: " + m + ":" + e.status));
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
	function whenIceDone(callback) {
		// todo: this a hack?
		pc.onicecandidate = ev => { if (ev.candidate == null) callback(); }
	}
	export function pc1(server, onConnectionInit, onMessage) {
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
						console.log("localhost:8000/?" + key);
						let qr = $("qrcode");
						qr.css({ position: 'absolute', top: $(document).height() / 2 - qrsize / 2, left: $(document).width() / 2 - qrsize / 2 });
						new QRCode(qr[0], {
							text: server + "|" + key,
							width: qrsize,
							height: qrsize
						});
						return $.get(server + key);
					}).then(deserializeRTCDesc).then(answer => {
						$("qrcode").remove();
						pc.setRemoteDescription(answer, succ, fail);
					}).fail(fail);
				});
			}, fail);

		}, fail);
	}

	export function pc2(server: string, key: string) {
		pc = new RTCPeerConnection(cfg, con);
		// this is what the client (android) does
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

if (location.search) RTC.pc2(server, location.search.substr(1));
else RTC.pc1(server, Pen.onConnectionInit.bind(Pen), Pen.onMessage.bind(Pen));