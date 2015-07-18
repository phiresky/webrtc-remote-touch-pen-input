#!/usr/bin/node --harmony
"use strict";

/**
 * step 1: PC sends `POST /` with the WebRTC request json as the data, gets the session key in return
 * step 2: PC sends `GET /:sessionkey`, server waits with response until step 3 and 4 are done
 * step 3: Phone retrieves session key from PC, sends `GET /:sessionkey`, gets the request json
 * step 4: Phone sends `POST /:sessionkey` with the WebRTC answer json
 * step 5: PC request from step 2 is answered with the answer json
 */

let fs = require('fs'),
	http = require('http'),
	crypto = require('crypto'),
	url = require('url');

let PORT = 3001;

let sessions = {}; // body:string, req: PC request
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
}).listen(PORT);