#!/usr/bin/node --harmony
"use strict";

let fs = require('fs'),
	http = require('http'),
	crypto = require('crypto'),
	url = require('url');

let PORT = 3001;

let sessions = {};

let server = http.createServer((req, res) => {
	console.log('new req');
	res.setHeader("Access-Control-Allow-Origin", "*");
	let key = url.parse(req.url).pathname.substr(1);
	if(req.method == 'POST') {
		let body = '';
		req.on('data', d => body+=d);
		req.on('end', () => {
			if(key.length == 0) {
				key = crypto.pseudoRandomBytes(12).toString('base64'); 
				sessions[key] = {body:body};
				res.end(key);
				return;
			} else if(key in sessions) {
				let info = sessions[key];
				info.res.end(body);
				delete sessions[key];
				res.end('success');
				return;
			}
		});
		return;
	} else {
		if(key in sessions) {
			let info = sessions[key];
			if(!info.res) {
				info.res = res;
			} else {
				res.end(info.body);
			}
			return;
		}
	}
	res.statusCode = 404;
	res.end("not found");
});

server.listen(PORT, () => {});
