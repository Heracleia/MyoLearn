#from sklearn.neural_network import MLPClassifier
from sklearn import svm
from sklearn.externals import joblib
from socketIO_client import SocketIO, BaseNamespace
import numpy as np
import time

class NNNamespace(BaseNamespace):
	def on_connect(self):
		print 'Connected to http://localhost:3000'
		
	def on_train(self, data):
		#Create dictionary of classes and raw incoming data
		rawDict = {}
		for entry in data:
			if rawDict.has_key(entry[0]):
				rawDict[entry[0]].append(entry[1])
			else:
				rawDict[entry[0]] = entry[1]
		
		#Create dictionary with raw data formatted properly
		dataDict = {}
		for key in rawDict.keys():
			final = []
			for set in rawDict[key]:
				for point in set['data']:
					formatted = [point['gyroX'], point['gyroY'], point['gyroZ'], point['accelX'], point['accelY'], point['accelZ']]
					final.append(formatted)
			dataDict[key] = final
		
		#Arrange data for svm reading
		X = []
		Y = []
		filename = time.strftime('%Y%m%d-%H%M%S')
		for key in dataDict.keys():
			x = dataDict[key]
			y = [str(key)] * len(x)
			X += x
			Y += y
			filename += str(key)
			
		clf = svm.LinearSVC()
		print clf.fit(X, Y)
		
		#Save to file
		filename = filename.replace(' ', '')
		joblib.dump(clf, 'dump/NN_' + filename + '.pkl')
		
		nn_sock.emit('trained', filename)
		
	def on_predict(self, data):
		clf = joblib.load('dump/NN_' + str(data['model']) + '.pkl')
		X = np.asarray(data['myodata']).reshape(1, -1)
		result = clf.predict(X)[0]
		nn_sock.emit('predict_data', result)
			
		
socketIO = SocketIO('localhost', 3000)
nn_sock = socketIO.define(NNNamespace, '/nn_namespace')
socketIO.wait()