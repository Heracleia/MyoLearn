var express = require('express');
var app = express();
var server = require('http').Server(app)
var io = require('socket.io')(server);
var myo = io.of('/myo_namespace');
var site = io.of('/site_namespace');
var myodata = [0, 0, 0, 0, 0, 0, 0];

app.use('/js', express.static(__dirname + '/node_modules/chart.js/dist/'));

server.listen(3000, function() {
	console.log('Listening on http://localhost:3000');
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

myo.on('connection', function(socket) {
	console.log('Myo connected');
	site.emit('myostatus', 'Myo connected');
	
	socket.on('disconnect', function() {
		console.log('Myo disconnected');
		site.emit('myostatus', 'Myo disconnected');
	});
	
	socket.on('data', function(data) {
		myodata = data;
	});
	
	setInterval(function() {
		site.emit('data', myodata);
	}, 50);
});

site.on('connection', function(socket) {	
	console.log('Site user connected');
	
	socket.on('disconnect', function() {
		console.log('Site user disconnected');
	});
});