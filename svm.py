from sklearn import svm
from sklearn.metrics import accuracy_score
from sklearn.externals import joblib
from socketIO_client import SocketIO, BaseNamespace
import numpy as np
import time

class SVMNamespace(BaseNamespace):
	def on_connect(self):
		print 'Connected to http://localhost:3000'
		
	def on_train(self, data):
		rawDict = {}
		for entry in data:
			if rawDict.has_key(entry[0]):
				rawDict[entry[0]].append(entry[1])
			else:
				rawDict[entry[0]] = entry[1]
				
		dataDict = {}
		for key in rawDict.keys():
			final = []
			for set in rawDict[key]:
				for point in set['data']:
					formatted = [point['gyroX'], point['gyroY'], point['gyroZ'], point['accelX'], point['accelY'], point['accelZ']]
					final.append(formatted)
			dataDict[key] = final
		
		clf = svm.LinearSVC()
		X = []
		Y = []
		filename = time.strftime('%Y%m%d-%H%M%S')
		for key in dataDict.keys():
			x = dataDict[key]
			y = [str(key)] * len(x)
			X += x
			Y += y
			filename += str(key)
		print clf.fit(X, Y)
		filename += '.pkl'
		filename = filename.replace(' ', '')
		joblib.dump(clf, 'dump/' + filename)
		svm_sock.emit('trained', filename)
		
	def on_predict(self, data):
		clf = joblib.load('dump/' + str(data['svm_model']))
		X = np.asarray(data['myodata']).reshape(1, -1)
		print clf.predict(X)
			
		
socketIO = SocketIO('localhost', 3000)
svm_sock = socketIO.define(SVMNamespace, '/svm_namespace')
socketIO.wait()