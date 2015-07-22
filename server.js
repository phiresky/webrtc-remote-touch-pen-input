#!/usr/bin/node --harmony
"use strict";

let fs = require('fs'),
	http = require('http'),
	crypto = require('crypto'),
	url = require('url');

let HOST = process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0";
let PORT = process.env.OPENSHIFT_NODEJS_PORT || 3001;

let sessions = {}; // key -> {body:string, req: PC WebRTC request string}
let sessionQueue = [];

let abort = res => { res.statusCode = 404; res.end("not found"); }
let removeOldSessions = () => { while (sessionQueue.length > 20) delete sessions[sessionQueue.shift()] }

function postRequest(body, key, res) {
	if (key.length == 0) {
		do key = crypto.pseudoRandomBytes(12).toString('base64');
		while (key in sessions);
		sessions[key] = { body: body };
		sessionQueue.push(key);
		removeOldSessions();
		res.end(key);
		return;
	} else if (key in sessions) {
		let info = sessions[key];
		info.res.end(body);
		delete sessions[key];
		res.end('success');
		return;
	} else abort(res);
}

function getRequest(key, res) {
	if(key.length == 0) res.end('hi'); // for up check
	if (key in sessions) {
		let info = sessions[key];
		if (!info.res) info.res = res;
		else res.end(info.body);
	} else abort(res);
}

http.createServer((req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	let key = url.parse(req.url).pathname.substr(1);
	if (req.method == 'POST') {
		let body = '';
		req.on('data', d => { body += d; if (body.length > 1e4) req.connection.destroy(); });
		req.on('end',() => postRequest(body, key, res));
	} else getRequest(key, res);
}).listen(PORT, HOST);
console.log("listening on " + HOST + ":" + PORT);