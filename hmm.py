#from sklearn import hmm
from socketIO_client import SocketIO, BaseNamespace
from sklearn.externals import joblib
from hmmlearn import hmm
import numpy as np
import time
import os.path

class HMMNamespace(BaseNamespace):
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
	
		#Arrange data for hmm reading
		model = []
		filename = time.strftime('%Y%m%d-%H%M%S')
		for key in dataDict.keys():
			model.append(hmm.GaussianHMM(n_components=1).fit(dataDict[key]))
			filename += str(key)
		
		#Save to file
		filename = filename.replace(' ', '')
		for i in range(0, len(model)):
			joblib.dump(model[i], 'dump/HMM_' + filename + str(i) + '.pkl')
		
		hmm_sock.emit('trained', filename)
		
	def on_predict(self, data):
		model = []
		i = 0
		while os.path.isfile('dump/HMM_' + str(data['model']) + str(i) + '.pkl'):
			model.append(joblib.load('dump/HMM_' + str(data['model']) + str(i) + '.pkl'))
			i += 1
		X = np.asarray(data['myodata']).reshape(1, -1)
		scores = []
		for m in model:
			scores.append(m.score(X))
		result = scores.index(max(scores))
		hmm_sock.emit('predict_data', result)
		
socketIO = SocketIO('localhost', 3000)
hmm_sock = socketIO.define(HMMNamespace, '/hmm_namespace')
socketIO.wait()