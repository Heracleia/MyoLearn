//Define global variables
var socket = io('/site_namespace'),
	myoconnected = false,
	recording = false,
	statusShown = false,
	predicting = false,
	model = '',
	clock = 0,
	offset = Date.now(),
	statusTimer = Number.MAX_VALUE,
	predictDict = [],
	predict_i = -1,
	colors = ["#e67e22", "#e74c3c", "#3498db", "#9b59b6", "#1abc9c"];

//Define charts
var gyroctx = $('#gyroChart'),
	accelctx = $('#accelChart'),
	predictctx = $('#predictChart'),
	gyrodata = {
		labels: Array.apply(null, Array(20)).map(String.prototype.valueOf, ""),
		datasets: [
			{
				label: 'Gyroscope X',
				backgroundColor: 'rgba(52, 152, 219,0.2)',
				borderColor: 'rgba(41, 128, 185,1.0)',
				data: Array.apply(null, Array(20)).map(Number.prototype.valueOf, 0)
			},
			{
				label: 'Gyroscope Y',
				backgroundColor: 'rgba(46, 204, 113,0.2)',
				borderColor: 'rgba(39, 174, 96,1.0)',
				data: Array.apply(null, Array(20)).map(Number.prototype.valueOf, 0)
			},
			{
				label: 'Gyroscope Z',
				backgroundColor: 'rgba(26, 188, 156,0.2)',
				borderColor: 'rgba(22, 160, 133,1.0)',
				data: Array.apply(null, Array(20)).map(Number.prototype.valueOf, 0)
			}
		]
	},
	acceldata = {
		labels: Array.apply(null, Array(20)).map(String.prototype.valueOf, ""),
		datasets: [
			{
				label: 'Acceleration X',
				backgroundColor: 'rgba(52, 152, 219,0.2)',
				borderColor: 'rgba(41, 128, 185,1.0)',
				data: Array.apply(null, Array(20)).map(Number.prototype.valueOf, 0)
			},
			{
				label: 'Acceleration Y',
				backgroundColor: 'rgba(46, 204, 113,0.2)',
				borderColor: 'rgba(39, 174, 96,1.0)',
				data: Array.apply(null, Array(20)).map(Number.prototype.valueOf, 0)
			},
			{
				label: 'Acceleration Z',
				backgroundColor: 'rgba(26, 188, 156,0.2)',
				borderColor: 'rgba(22, 160, 133,1.0)',
				data: Array.apply(null, Array(20)).map(Number.prototype.valueOf, 0)
			}
		]
	},
	predictdata = {
		labels: [],
		datasets: [{
			data: [],
			backgroundColor: []
		}]
	};
	
//Create gyro chart
var gyroChart = new Chart(gyroctx, {
	type: 'line',
	data: gyrodata,
	options: {
		scales: {
			xAxes: [{
				gridLines: {
					display: false
				},
			}],
			yAxes: [{
				ticks: {
					suggestedMin: -1000,
					suggestedMax: 1000
				}
			}]
		},
		elements: {
			point: {
				radius: 0
			}
		}
	}
});			

//Create accel chart	
var accelChart = new Chart(accelctx, {
	type: 'line',
	data: acceldata,
	options: {
		scales: {
			xAxes: [{
				gridLines: {
					display: false
				},
			}],
			yAxes: [{
				ticks: {
					suggestedMin: -5,
					suggestedMax: 5
				}
			}]
		},
		elements: {
			point: {
				radius: 0
			}
		}
	}
});

//Create predict chart
var predictChart = new Chart(predictctx, {
	type: 'doughnut',
	data: predictdata,
	options: {
		
	}
});

//Initialization
$('#recordButton').prop('disabled', true);
$('#stopButton').prop('disabled', true);
showStatus("Waiting for myo to be connected...", "#f1c40f", Number.MAX_VALUE);

//Myo connection
socket.on('myoconnected', function() {
	if(!myoconnected) {
		showStatus("Myo connected", "#2ecc71", 3000);
		myoconnected = true;
		$('#recordButton').prop('disabled', false);
	}	
});
socket.on('myodc', function() {
	showStatus("Myo disconnected", "#e74c3c", 3000);
	myoconnected = false;
	stopRecording();
});
socket.on('data', function(data) {	
	//Update charts
	for(i = 0; i < 3; i++) {
		gyrodata.datasets[i].data.shift();
		acceldata.datasets[i].data.shift();
		gyrodata.datasets[i].data.push(data[i+1]);
		acceldata.datasets[i].data.push(data[i+4]);
	}
	gyroChart.data = gyrodata;
	accelChart.data = acceldata;
	gyroChart.update();
	accelChart.update();
	
	//If recording, emit recording data
	if(recording)
		socket.emit('data', data);
	
	//If predicting, emit prediction data
	if(predicting)
		socket.emit('svm_predict', {svm_model: model, myodata: data.slice(1,7)});
});

//Recording input
$('#recordButton').on('click', function(e) {
	$('#recordModal').modal('show');
});
$('#recordModalConfirm').on('click', function(e) {
	e.preventDefault();
	
	var dataClass = $('#cdc').val();
	$('#tdc').append("<option>" + dataClass + "</option>");
	socket.emit('record', dataClass);
	
	$('#recordModal').modal('hide');
	$('#stopButton').prop('disabled', false);
	$('#recordButton').prop('disabled', true);
	recording = true;
	showStatus("Recording...", "#e74c3c", Number.MAX_VALUE)
	offset = Date.now();
});
$('#stopButton').on('click', function(e) {
	stopRecording();
});

//SVM training input
$('#svm_train_button').on('click', function(e) {
	e.preventDefault();
	
	var values = $('#tdc').val() || [];
	socket.emit('svm_train', values);
});

//SVM predict input
$('#svm_predict_button').on('click', function(e) {
	e.preventDefault();
	
	predicting = true;
	socket.emit('svm_predict_start');
	showStatus("Predicting...", "#f1c40f", Number.MAX_VALUE);
	model = $('#pdc').val();
});
$('#svm_predict_stop').on('click', function(e) {
	predicting = false;
	predict_i = -1;
	predictDict = [];
	predictdata.labels = [];
	predictdata.datasets[0].data = [];
	predictdata.datasets[0].backgroundColor = [];
	predictChart.data = predictdata;
	predictChart.update();
	showStatus("Predicting stopped", "#2ecc71", 3000);
	socket.emit('svm_predict_stop');
});

//Update predict graph
socket.on('predict_data', function(data) {
	if(predicting) {
		//If not in graph, initialize option
		if(predictDict[data] == null) {
			predictDict[data] = ++predict_i;
			predictdata.labels[predictDict[data]] = data;
			predictdata.datasets[0].data[predictDict[data]] = 0;
			predictdata.datasets[0].backgroundColor[predictDict[data]] = colors[predictDict[data]];
		}
		
		//Increase value for option
		predictdata.datasets[0].data[predictDict[data]]++;
		
		//Adjust based on sum
		var sum = 0;
		$.each(predictdata.datasets[0].data, function(index, value) {
			sum += value;
		});
		if(sum > 10) {
			$.each(predictdata.datasets[0].data, function(index, value) {
				if(value > 0)
					predictdata.datasets[0].data[index]--;
			});
		}
		
		//Give result to server for database
		socket.emit('predictResult', data);
		
		//Update graph
		predictChart.data = predictdata;
		predictChart.update();
	}	
});

//Update dynamic fields
socket.on('addClass', function(entry) {
	$('#tdc').append("<option>" + entry + "</option>");
	$('#tdc').attr("size", $("#tdc option").length);
});
socket.on('addModel', function(model) {
	$('#pdc').append("<option>" + model + "</option>");
});

//Show status
socket.on('showStatus', function(msg) {
	console.log(msg);
	showStatus(msg.statusText, msg.bgcolor, msg.timeout);
});
function showStatus(statusText, bgcolor, timeout) {
	statusTimer = timeout;	
	$('#myostatus').html("<h5>" + statusText + "</h5>");
	$('.bg-status').css("background-color", bgcolor);
}

//Hide status on click
$('#myostatus').on('click', function(e) {
	statusTimer = 0;
});

//Stop recording (on stop or dc)
function stopRecording() {
	$('#stopButton').prop('disabled', true);
	$('#recordButton').prop('disabled', false);
	clock = 0;
	if(recording) {
		recording = false;
		showStatus("Recording has been saved", "#2ecc71", 3000);
		$('#timer').html('00:00');
		socket.emit('stop');
	}
}

//Update function
setInterval(function() {
	var deltaTime = Date.now() - offset;
	
	//Update status timer
	if(statusTimer > 0) {
		statusTimer -= deltaTime;
		if(!statusShown) {
			statusShown = true;
			$('#myostatus').collapse('show');
		}
	} else if(statusShown) {
		statusShown = false;
		$('#myostatus').collapse('hide');
	}
	
	//Update recording timer
	if(recording) {
		clock += deltaTime;
		var minutes = Math.floor(clock / 60000);
		var seconds = Math.round(clock / 1000 - minutes * 60);
		var fint = (new Array(3).join(0) + String(minutes)).slice(-2) + ':' + (new Array(3).join(0) + String(seconds)).slice(-2);
		$('#timer').html(fint);
	}
	
	offset = Date.now();
}, 100);

