var express = require('express');
var app = express();
var server = require('http').Server(app)
var io = require('socket.io')(server);
var myodata = [0, 0, 0, 0, 0, 0, 0];

app.use('/js', express.static(__dirname + '/node_modules/chart.js/dist/'));

server.listen(3000, function() {
	console.log('Listening on http://localhost:3000');
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {	
	console.log('User connected');
	
	socket.on('disconnect', function() {
		console.log('User disconnected');
	});
	
	socket.on('myoconnected', function() {
		io.emit('myostatus', 'Myo connected');
	});
	
	socket.on('myoin', function(data) {
		myodata = data;
	});
	
	setInterval(function() {
		socket.emit('myoout', {'myoout': myodata});
	}, 50);
});