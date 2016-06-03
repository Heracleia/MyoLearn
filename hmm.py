from sklearn import hmm
from socketIO_client import SocketIO, BaseNamespace
import numpy as np

class HMMNamespace(BaseNamespace):
	def on_connect(self):
		print 'Connected to http://localhost:3000'
		
	def on_train(self, data):
		print 'Train'
		
	def on_predict(self, data):
		print 'Predict'
		
socketIO = SocketIO('localhost', 3000)
hmm_sock = socketIO.define('/hmm_namespace')
socketIO.wait()