declare var QRCode: any;
let server = `http://${location.host.split(':')[0]}:3001/`;

module Pen {
	enum ToolType {
		unknown, finger, stylus, mouse, eraser
	}
	interface info {
		x: number, y: number, action: number, event: string, pressure: number, tooltype: ToolType
	}
	let moveDiv = $("<div style='position:absolute; width:100px; height:100px; top:0; left:0; background:black; border-radius: 100%'>");
	export function onConnectionInit() {
		moveDiv.appendTo($("body"));
	}
	export function onMessage(msg:string) {
		let data:info = JSON.parse(msg);
		if (data.event == 'touch')
			moveDiv.css({ top: data.y, left: data.x, background: data.tooltype == ToolType.finger ? 'red' : 'green', width: data.pressure * 200, height: data.pressure * 200 });
		else
			moveDiv.css({ top: data.y, left: data.x, background: 'black', width: 100, height: 100 });
	
	}
}
module RTC {
	export let pc: RTCPeerConnection;
	export let channel: RTCDataChannel;
	let cfg = { iceServers: [{ url: "stun:23.21.150.121" }] };
	let con = { optional: [{ DtlsSrtpKeyAgreement: true }] };
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
		channel = pc.createDataChannel('test', { reliable: true });
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
						new QRCode($("qrcode")[0], {
							text: server + "|" + key,
							width: 300,
							height: 300
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