
function main(){
	var field 		= document.getElementById('messageField');
	var gangnamList = document.getElementById('gangnamList');
	var status 		= document.getElementById('status');
	var list 		= document.getElementById('messageList');

	field.addEventListener('keydown', onMessageFieldKeydown);
	gangnamList.addEventListener('click', onGangnamClick);

	var socket, connected;


	function updateStatus(value){
		status.innerText = value;
		console.log('hey', value);
	}


	function addMessageItemToList(message, type, isFromMe){
		var item = document.createElement('li');
		if(isFromMe) item.classList.add('me');
		if(type === 'text'){
			item.innerText = message;
		}
		else if(type === 'img'){
			var img = document.createElement('img');
			img.src = 'img/gangnam/gangnam_' + message + '.png';
			item.appendChild(img);
		}

		var firstItem = document.querySelector('#messageList > li:first-child');
		if(firstItem) list.insertBefore(item, firstItem);
		else list.appendChild(item);
	}


	function connectWebSocket(){
		socket = new WebSocket('ws://localhost:8910');
		socket.onopen = function(e){
			updateStatus('connected :)');
			connected = true;
		};
		socket.onmessage = function(e){
			var msg = JSON.parse(e.data);
			addMessageItemToList(msg.content, msg.type);
		};
		socket.onclose = function(e){
			updateStatus('closed :(');
			connected = false;
		};
		socket.onerror = function(e){
			updateStatus('ERROR -____-');
			connected = false;
		};
		updateStatus('connecting ...');
	}


	function send(content, type){
		if(connected){
			type = type || 'text';
			var message = JSON.stringify({
				type: type,
				content: content
			});
			console.log('msg', message);
			socket.send(message);
		}
	}


	function onMessageFieldKeydown(e){
		if(e.keyCode === 13 && field.value){
			send(field.value);
			addMessageItemToList(field.value, 'text', true);
			field.value = '';
		}
	}


	function onGangnamClick(e){
		var id = e.target.getAttribute('data-id');
		send(id, 'img');
		addMessageItemToList(id, 'img', true);
	}


	connectWebSocket();
}

document.addEventListener('DOMContentLoaded', main);