
var http = require('http'),
	crypto = require('crypto');


var GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
	sockets = [];


/**
 * create websocket server
 * @param {String} host
 * @param {int} port
 */
function createWebSocketServer(host, port){
	//first we create a http server
	var server = http.createServer(function(req, res){
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('Hello World');
	});

	//listen for upgrade event of the http server
	//when client is trying to upgrade the http connection to websocket, we should finish the handshake here
	server.on('upgrade', function(req, socket, head){
		//read the client key on request header and generate a accept key
		var key = req.headers['sec-websocket-key'];
		var accept = getWebSocketAcceptKey(key);
		//write the handshake response back to client
		socket.write(getHandshakeResponse(accept));
		sockets.push(socket);
		//now websocket session should be established, let's wait for client's message
		socket.on('data', function(buffer){
			var data = extractContentFromDataFrame(buffer);
			console.log('[Socket] receive data frame:', data);
			switch(data.type){
				case 'text':
					broadcastToAllSockets(data.content, socket);
					break;

				case 'close':
					console.log('[Socket] receive close signal');
					socket.end(getCloseDataFrame());
					break;
			}
		});
		socket.on('close', function(hadError){
			removeSocketRefAfterClosed(socket);
			console.log('[Socket] close', hadError);
		});
	});

	//bind http server to specify host and port
	server.listen(port, host, function(){
		console.log('[Server] I am up :)');
	});

	return server;
}


function broadcastToAllSockets(content, fromSocket){
	var frame = getTextDataFrame(content);
	for(var i=0; i<sockets.length; i++){
		if(sockets[i] != fromSocket){
			sockets[i].write(frame);
		}
	}
}


function removeSocketRefAfterClosed(socket){
	for(var i=0; i<sockets.length; i++){
		if(sockets[i] === socket){
			sockets.splice(i, 1);
		}
	}
}


function getWebSocketAcceptKey(key){
	var sha = crypto.createHash('sha1');
	sha.update(key + GUID);
	return sha.digest('base64');
}


function getHandshakeResponse(accept){
	return 'HTTP/1.1 101 Switching Protocols\r\n' +
		   'Upgrade: websocket\r\n' +
		   'Connection: Upgrade\r\n' +
		   'Sec-WebSocket-Accept: ' + accept + '\r\n' +
		   '\r\n'
}


function getTextDataFrame(content){
	content = content.substr(0, 125);
	var length = content.length,
		frame = new Buffer(2 + length);
	frame[0] = 0x81;
	frame[1] = length;
	frame.write(content, 2);
	return frame;
}


function getCloseDataFrame(){
	var frame = new Buffer(2);
	frame[0] = 0x88; //1 0 0 0 1 0 0 0
	frame[1] = 0x0;  //0 0 0 0 0 0 0 0
	return frame;
}


function extractContentFromDataFrame(buffer){
	var opcode = buffer[0] & 0x0F;
	switch(opcode){
		case 0x01:
			var masked = (buffer[1] >> 7 === 1),
				mask = null,
				length = buffer[1] & 0x7F,
				offset = 2;
			//if length is 126, read the following 2 bytes as length
			if(length === 126){
				length = buffer.readUIntBE16(2);
				offset += 2;
			}
			//if length is 124, read the following 8 bytes as length
			else if(length === 127){
				length = buffer.readUintBE32(2) << 32 + buffer.readUintBE32(6);
				offset += 8;
			}
			//if payload is masked, read the mask-key
			if(masked){
				mask = buffer.slice(offset, offset+4);
				offset += 4;
			}
			var rawContent = buffer.slice(offset, offset+length);
			var content = unmaskBuffer(mask, rawContent);
			return {
				type: 'text',
				length: length, 
				content: content.toString()
			};

		case 0x08:
			return {type:'close'};

		default:
			return {type:'unknown'};
	}
}


function unmaskBuffer(mask, buffer){
	if(mask){
		var len = buffer.length
			result = new Buffer(len);
		for(var i=0; i<len; i++){
			result[i] = buffer[i] ^ mask[i%4];
		}
		return result;
	}
	else return buffer;
}


createWebSocketServer('localhost', 8910);