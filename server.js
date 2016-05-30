var express = require('express');
var app = express();
var server = require('http').Server(app)
var io = require('socket.io')(server);
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var myo = io.of('/myo_namespace');
var site = io.of('/site_namespace');
var svm = io.of('/svm_namespace');
var myodata = [0, 0, 0, 0, 0, 0, 0];

app.use('/js', express.static(__dirname + '/node_modules/chart.js/dist/'));
app.use('/js', express.static(__dirname + '/js/'));
app.use('/css', express.static(__dirname + '/css/'));

mongoose.connect('mongodb://localhost:27017/myolearn');
var myoDataSchema = new Schema({
	clock: Number,
	gyroX: Number,
	gyroY: Number,
	gyroZ: Number,
	accelX: Number,
	accelY: Number,
	accelZ: Number
});
var sessionSchema = new Schema({
	date: {type: Date, default: Date.now},
	dataclass: String,
	data: [myoDataSchema]
});
var Session = mongoose.model('Session', sessionSchema);
var MyoData = mongoose.model('MyoData', myoDataSchema); 

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
	
	var session = null;
	socket.on('record', function(type) {
		session = new Session({dataclass: type, data: []});
	});	
	socket.on('stop', function() {
		session.save(function(err, sessionObj) {
			if(err) {
				console.log(err);
			} else {
				console.log('Saved session successfully');
			}
		});
	});
	socket.on('data', function(data) {
		session.data.push({
			clock: data[0],
			gyroX: data[1],
			gyroY: data[2],
			gyroZ: data[3],
			accelX: data[4],
			accelY: data[5],
			accelZ: data[6]
		});
	});
	
	socket.on('svm_train', function(classes) {
		var datagroups = [];
		var processed = 0;
		classes.forEach(function(entry) {
			var query = Session.find({dataclass: entry})
			query.select('data');
			query.exec(function(err, data) {
				if(err) {
					console.log(err);
				} else {
					datagroups.push([entry, data]);
					if(++processed == classes.length) {
						svm.emit('train', datagroups);
					}
				}
			});
		});
	});
	
	socket.on('svm_predict', function() {
		svm.emit('predict');
	});
	
	setInterval(function() {
		myo.emit('ping_myo');
	}, 5000);
});

svm.on('connection', function(socket) {
	console.log('SVM connected');
	
	socket.on('trained', function() {
		console.log('Training complete')
	});
	
	socket.on('disconnect', function() {
		console.log('SVM disconnected');
	});
});