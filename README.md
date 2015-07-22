# WebRTC Android Browser Remote Pen/Touch Input

Uses a peer to peer WebRTC connection to transmit touch/pen input from an android phone to a PC browser.

Connection is established using a simple QR code.

A hosted version of the web component is at https://phiresky.github.io/webrtc-remote-touch-pen-input

The compiled android component can be found in [releases](https://github.com/phiresky/webrtc-remote-touch-pen-input/releases)

## Demo

[![Youtube Demo](http://share.gifyoutube.com/mLDpOR.gif)](https://www.youtube.com/watch?v=Gvsm84xL9Sk)

[(YouTube)](https://www.youtube.com/watch?v=Gvsm84xL9Sk)

## Source

* `src/webrtcpen.ts`
  * module `WebRTCPen.RTC`: builds the connection and installs data listeners
  * module `WebRTCPen` provides mouse emulation and the `info` element which contains position and pressure information
* `src/drawing.ts` canvas drawing module using paper.js

## How it works

Currently it needs a tiny server for establishing the connection that does the following (see `server.js`):

1. PC sends `POST /` with the WebRTC request json as the data, gets the session key in return
2. PC sends `GET /:sessionkey`, server waits with response until step 3 and 4 are done
3. Phone retrieves session key from PC, sends `GET /:sessionkey`, gets the request json
4. Phone sends `POST /:sessionkey` with the WebRTC answer json
5. PC request from step 2 is answered with the answer json
