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
	selselDataclass = '',
	colors = ["#e67e22", "#e74c3c", "#3498db", "#9b59b6", "#1abc9c"];

//Define charts
var gyroctx = $('#gyroChart'),
	accelctx = $('#accelChart'),
	svmpredictctx = $('#svmPredictChart'),
	hmmpredictctx = $('#hmmPredictChart'),
	nnpredictctx = $('#nnPredictChart'),
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
	svmpredictdata = {
		labels: [],
		datasets: [{
			data: [],
			backgroundColor: []
		}]
	},
	hmmpredictdata = {
		labels: [],
		datasets: [{
			data: [],
			backgroundColor: []
		}]
	},
	nnpredictdata = {
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

//Create predict charts
var svmPredictChart = new Chart(svmpredictctx, {
	type: 'doughnut',
	data: svmpredictdata,
	options: {
		title: {
			display: true,
			text: 'Support Vector Machine'
		}
	}
}),
	hmmPredictChart = new Chart(hmmpredictctx, {
	type: 'doughnut',
	data: hmmpredictdata,
	options: {
		title: {
			display: true,
			text: 'Hidden Markov Model'
		}
	}
}),
	nnPredictChart = new Chart(nnpredictctx, {
	type: 'doughnut',
	data: nnpredictdata,
	options: {
		title: {
			display: true,
			text: 'Neural Network'
		}
	}
});

//Initialization
$('#recordButton').prop('disabled', true);
$('#stopButton').prop('disabled', true);
$('#predict_start').prop('disabled', true);
$('#predict_stop').prop('disabled', true);
showStatus("Waiting for myo to be connected...", "#f1c40f", Number.MAX_VALUE);

//Myo connection
socket.on('myoconnected', function() {
	if(!myoconnected) {
		myoconnected = true;
		if(!recording && !predicting) {
			showStatus("Myo connected", "#2ecc71", 3000);
			$('#recordButton').prop('disabled', false);
			$('#predict_start').prop('disabled', false);
		}
	}
});
socket.on('myodc', function() {
	myoconnected = false;
	setTimeout(function() {
		if(!myoconnected) {
			showStatus("Myo disconnected", "#e74c3c", 3000);
			stopRecording();
		}
	}, 5000);
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
		socket.emit('predict', {model: model, myodata: data.slice(1,7)});
});

//Recording input
$('#recordButton').on('click', function(e) {
	$('#recordModal').modal('show');
});
$('#recordModalConfirm').on('click', function(e) {
	e.preventDefault();
	
	selDataclass = $('#cdc').val();
	
	//Check if class already exists
	socket.emit('check_exists', selDataclass, function(err, msg) {
		if(err) {
			console.log(err);
		} else {
			$('#recordModal').modal('hide');
			if(msg == 1) {
				$('#overwriteModal').modal('show');
			} else {
				addClass(selDataclass);
				startRecording();
			}
		}
	});	
});
$('#stopButton').on('click', function(e) {
	stopRecording();
});

//Overwrite modal
$('#overwriteAppend').on('click', function() {
	$('#overwriteModal').modal('hide');
	startRecording();
});
$('#overwriteOverwrite').on('click', function() {
	$('#overwriteModal').modal('hide');
	socket.emit('remove_class', selDataclass);
	startRecording();
});

//Training input
$('#train_button').on('click', function(e) {
	e.preventDefault();
	
	var values = $('#tdc').val() || [];
	socket.emit('train', values);
});

//Predict input
$('#predict_start').on('click', function(e) {
	e.preventDefault();
	
	socket.emit('predict_start');
	model = $('#pdc').val();
	$('#predict_start').prop('disabled', true);
	$('#predict_stop').prop('disabled', false);
	setTimeout(function() {
		showStatus("Predicting...", "#f1c40f", Number.MAX_VALUE);
		predicting = true;
	}, 500);
});
$('#predict_stop').on('click', function(e) {
	socket.emit('predict_stop');
	$('#predict_start').prop('disabled', false);
	$('#predict_stop').prop('disabled', true);
	predicting = false;
	predict_i = -1;
	predictDict = [];
	svmpredictdata.labels = [];
	svmpredictdata.datasets[0].data = [];
	svmpredictdata.datasets[0].backgroundColor = [];
	svmPredictChart.data = svmpredictdata;
	svmPredictChart.update();
	hmmpredictdata.labels = [];
	hmmpredictdata.datasets[0].data = [];
	hmmpredictdata.datasets[0].backgroundColor = [];
	hmmPredictChart.data = hmmpredictdata;
	hmmPredictChart.update();
	nnpredictdata.labels = [];
	nnpredictdata.datasets[0].data = [];
	nnpredictdata.datasets[0].backgroundColor = [];
	nnPredictChart.data = nnpredictdata;
	nnPredictChart.update();
	statusTimer = 0;
});

//Update predict graphs
socket.on('svm_predict_data', function(data) {
	if(predicting) {
		//If not in graph, initialize option
		if(predictDict[data] == null) {
			addPredictClass(data);
		}
		
		//Increase value for option
		svmpredictdata.datasets[0].data[predictDict[data]]++;
		
		//Adjust based on sum
		var sum = 0;
		$.each(svmpredictdata.datasets[0].data, function(index, value) {
			sum += value;
		});
		if(sum > 10) {
			$.each(svmpredictdata.datasets[0].data, function(index, value) {
				if(value > 0)
					svmpredictdata.datasets[0].data[index]--;
			});
		}
		
		//Give result to server for database
		socket.emit('svm_predict_result', data);
		
		//Update graphs
		svmPredictChart.data = svmpredictdata;
		svmPredictChart.update();
	}	
});
socket.on('hmm_predict_data', function(data) {
	if(predicting) {
		//If not in graph, initialize option
		if(predictDict[data] == null) {
			addPredictClass(data);
		}
		
		//Increase value for option
		hmmpredictdata.datasets[0].data[predictDict[data]]++;
		
		//Adjust based on sum
		var sum = 0;
		$.each(hmmpredictdata.datasets[0].data, function(index, value) {
			sum += value;
		});
		if(sum > 10) {
			$.each(hmmpredictdata.datasets[0].data, function(index, value) {
				if(value > 0)
					hmmpredictdata.datasets[0].data[index]--;
			});
		}
		
		//Give result to server for database
		socket.emit('hmm_predict_result', data);
		
		//Update graphs
		hmmPredictChart.data = hmmpredictdata;
		hmmPredictChart.update();
	}	
});
socket.on('nn_predict_data', function(data) {
	if(predicting) {
		//If not in graph, initialize option
		if(predictDict[data] == null) {
			addPredictClass(data);
		}
		
		//Increase value for option
		nnpredictdata.datasets[0].data[predictDict[data]]++;
		
		//Adjust based on sum
		var sum = 0;
		$.each(nnpredictdata.datasets[0].data, function(index, value) {
			sum += value;
		});
		if(sum > 10) {
			$.each(nnpredictdata.datasets[0].data, function(index, value) {
				if(value > 0)
					nnpredictdata.datasets[0].data[index]--;
			});
		}
		
		//Give result to server for database
		socket.emit('nn_predict_result', data);
		
		//Update graphs
		nnPredictChart.data = nnpredictdata;
		nnPredictChart.update();
	}	
});

//Update dynamic fields
socket.on('clear_classes', function() {
	$('#tdc').empty();
});
socket.on('clear_models', function() {
	$('#pdc').empty();
});
socket.on('add_class', function(entry) {
	addClass(entry);
});
function addClass(entry) {
	$('#tdc').append("<option>" + entry + "</option>");
	$('#tdc').attr("size", $("#tdc option").length);
}
socket.on('add_model', function(model) {
	$('#pdc').append("<option>" + model + "</option>");
});

//Show status
socket.on('show_status', function(msg) {
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

//Start recording
function startRecording() {
	socket.emit('record', selDataclass);	
	$('#stopButton').prop('disabled', false);
	$('#recordButton').prop('disabled', true);
	recording = true;
	showStatus("Recording...", "#e74c3c", Number.MAX_VALUE)
	offset = Date.now();
}

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

//Add class to predict graphs
function addPredictClass(data) {
	predict_i++;
	predictDict[data] = predict_i;
	svmpredictdata.labels[predictDict[data]] = data;
	hmmpredictdata.labels[predictDict[data]] = data;
	nnpredictdata.labels[predictDict[data]] = data;
	svmpredictdata.datasets[0].data[predictDict[data]] = 0;
	hmmpredictdata.datasets[0].data[predictDict[data]] = 0;
	nnpredictdata.datasets[0].data[predictDict[data]] = 0;
	svmpredictdata.datasets[0].backgroundColor[predictDict[data]] = colors[predictDict[data]];
	hmmpredictdata.datasets[0].backgroundColor[predictDict[data]] = colors[predictDict[data]];
	nnpredictdata.datasets[0].backgroundColor[predictDict[data]] = colors[predictDict[data]];
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

