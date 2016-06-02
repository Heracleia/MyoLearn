//Define global variables
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

//Define static directories
app.use('/js', express.static(__dirname + '/node_modules/chart.js/dist/'));
app.use('/js', express.static(__dirname + '/js/'));
app.use('/css', express.static(__dirname + '/css/'));

//Connect to database
mongoose.connect('mongodb://localhost:27017/myolearn');

//Define schemas
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
var modelSchema = new Schema({
	name: String
});
var predictDataSchema = new Schema({
	dataclass: String
});
var predictSchema = new Schema({
	date: {type: Date, default: Date.now},
	data: [predictDataSchema]
});

//Define models
var Model = mongoose.model('Model', modelSchema);
var Session = mongoose.model('Session', sessionSchema);
var MyoData = mongoose.model('MyoData', myoDataSchema);
var Predict = mongoose.model('Predict', predictSchema);
var PredictData = mongoose.model('PredictData', predictDataSchema);

server.listen(3000, function() {
	console.log('Listening on http://localhost:3000');
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

//On site connection
site.on('connection', function(socket) {	
	console.log('Site user connected');	
	socket.on('disconnect', function() {
		console.log('Site user disconnected');
	});
	
	//Check if myo is connected
	myo.emit('ping_myo');
	
	//Update site fields with data from database
	Session.find().distinct('dataclass', function(err, classes) {
		if(err) {
			console.log(err);
		} else {
			classes.forEach(function(entry) {
				socket.emit('addClass', entry);
			});
		}
	});	
	Model.find().distinct('name', function(err, names) {
		if(err) {
			console.log(err);
		} else {
			names.forEach(function(model) {
				socket.emit('addModel', model);
			});
		}
	});
	
	//Create recording session to be added to database
	var session = null;
	socket.on('record', function(type) {
		session = new Session({dataclass: type, data: []});
	});
	
	//Add data to session
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
	
	//Save session to database
	socket.on('stop', function() {
		session.save(function(err, sessionObj) {
			if(err) {
				console.log(err);
			} else {
				console.log('Saved session successfully');
			}
		});
	});
	
	//On train, gather training data from database and pass to svm
	socket.on('svm_train', function(classes) {
		var datagroups = [];
		var processed = 0;
		socket.emit('showStatus', {statusText: "Training...", bgcolor: "#f1c40f", timeout: Number.MAX_VALUE});
		if(classes.length < 2) {
			socket.emit('showStatus', {statusText: "Select two or more classes", bgcolor: "#e74c3c", timeout: 3000});
		} else {
			classes.forEach(function(entry) {
				var query = Session.find({dataclass: entry})
				query.select('data');
				query.exec(function(err, data) {
					if(err) {
						console.log(err);
					} else{
						if(data.length == 0) {
							console.log('No data');
						} else {
							datagroups.push([entry, data]);
							if(++processed == classes.length) {
								svm.emit('train', datagroups);
								socket.emit('showStatus', {statusText: "Training complete", bgcolor: "#2ecc71", timeout: 3000});
							}
						}
					}
				});
			});
		}
	});
	
	//Predict data communication with database
	var predict = null;
	socket.on('svm_predict_start', function() {
		predict = new Predict({data: []})
	});	
	socket.on('predictResult', function(data) {
		predict.data.push({
			dataclass: data
		});
	});
	socket.on('svm_predict_stop', function() {
		predict.save(function(err, predictObj) {
			if(err)
				console.log(err);
		});
	});
	
	//Forward myo data from site to svm
	socket.on('svm_predict', function(data) {
		svm.emit('predict', data); //Data contains .svm_model and .myodata
	});
	
	//Check myo connection every 5 seconds
	setInterval(function() {
		myo.emit('ping_myo');
	}, 5000);
});

//On myo connection
myo.on('connection', function(socket) {
	console.log('Myo connected');
	socket.on('disconnect', function() {
		console.log('Myo disconnected');
		site.emit('myodc');
	});
	
	//Confirm for site that myo is connected
	socket.on('confirm', function() {
		site.emit('myoconnected');
	});
	
	//Update incoming data
	socket.on('data', function(data) {
		myodata = data;
	});
	
	//Constantly emit data
	setInterval(function() {
		site.emit('data', myodata);
	}, 60);
});

//On svm connection
svm.on('connection', function(socket) {
	console.log('SVM connected');
	socket.on('disconnect', function() {
		console.log('SVM disconnected');
	});
	
	//Update site when training information is received
	socket.on('trained', function(filename) {
		var model = new Model({name: filename});
		model.save(function(err, modelObj) {
			if(err) {
				console.log(err);
			} else {
				console.log('Model ' + modelObj + ' saved');
			}
		});
		site.emit('train_status', 'Training complete');
		site.emit('addModel', filename);
	});
	
	//Forward predict data from svm to site
	socket.on('predict_data', function(data) {
		site.emit('predict_data', data);
	});
});