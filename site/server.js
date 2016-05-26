var express = require('express');
var app = express();
var server = require('http').Server(app)
var io = require('socket.io')(server);
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var url = 'mongodb://localhost:27017/myolearn';
var myo = io.of('/myo_namespace');
var site = io.of('/site_namespace');
var myodata = [0, 0, 0, 0, 0, 0, 0];

app.use('/js', express.static(__dirname + '/node_modules/chart.js/dist/'));
app.use('/js', express.static(__dirname + '/js/'));
app.use('/css', express.static(__dirname + '/css/'));

server.listen(3000, function() {
	console.log('Listening on http://localhost:3000');
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

myo.on('connection', function(socket) {
	console.log('Myo connected');
	site.emit('myostatus', 'Myo connected');
	
	socket.on('confirm', function() {
		site.emit('myoconnected');
	});
	
	socket.on('disconnect', function() {
		console.log('Myo disconnected');
		site.emit('myodc');
	});
	
	socket.on('data', function(data) {
		myodata = data;
	});
	
	setInterval(function() {
		site.emit('data', myodata);
	}, 60);
});

site.on('connection', function(socket) {	
	console.log('Site user connected');
	myo.emit('ping_myo');
	
	socket.on('disconnect', function() {
		console.log('Site user disconnected');
	});
	
	setInterval(function() {
		myo.emit('ping_myo');
	}, 5000);
});

MongoClient.connect(url, function(err, db) {
	if(err) {
		console.log('Unable to connect to the mongoDB server. Error:', err);
	} else {
		console.log('Connection established to', url);
		
		var collection = db.collection('sessions');
		var session = {date: String(Date()), user: 'Dylan'};
		collection.insert(session, function(err, result) {
			if(err) {
				console.log(err);
			} else {
				console.log('Inserted session into "sessions" collection');
			}
			
			db.close();
		});
	}
});