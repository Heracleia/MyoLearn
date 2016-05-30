from sklearn import svm
from sklearn.metrics import accuracy_score
from sklearn.externals import joblib
from socketIO_client import SocketIO, BaseNamespace

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
		
		clf = svm.SVC()
		X = []
		Y = []
		for key in dataDict.keys():
			x = dataDict[key]
			y = [str(key)] * len(x)
			X += x
			Y += y
		print clf.fit(X, Y)
		joblib.dump(clf, 'dump/clf.pkl')
		svm_sock.emit('trained')
		
	def on_predict(self):
		clf = joblib.load('dump/clf.pkl')
		data = [0, 0, 0, 0, 0, 0]
		print clf.predict(data)
			
		
socketIO = SocketIO('localhost', 3000)
svm_sock = socketIO.define(SVMNamespace, '/svm_namespace')
socketIO.wait()