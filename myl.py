# -*- coding: utf-8 -*-
"""
Created on Mon May 09 16:05:02 2016

@author: Dylan Ebert
"""

from sklearn import svm
from sklearn.metrics import accuracy_score
from sklearn.externals import joblib
from socketIO_client import SocketIO, LoggingNamespace
import myo as libmyo
import numpy as np
import sys
import time
import easygui
import csv
import struct
import pickle

class MyoLearn():	 	
	def __init__(self):
		print 'Starting...'	
		
		try:
			libmyo.init()
		except:
			pass		
		feed = libmyo.device_listener.Feed()
		self.hub = libmyo.Hub()
		self.hub.run(1000, feed)
		self.myo = feed.wait_for_single_device(timeout = 5.0)
		if not self.myo:
			print 'Timeout: no myo found'
			#sys.exit()		
		
		while 1:
			print '\n~Welcome~'
			print '1: Record'
			print '2: Train'
			print '3: Predict'
			print '4: Quit'
			option = int(input())
			if option == 1:
				self.record()
			elif option == 2:
				self.train()
			elif option == 3:
				self.predict()
			elif option == 4:
				break
			else:
				print 'Invalid input'
		
		print 'Shutting down...'
		self.hub.shutdown()
	
	def record(self):		 
		allt = ""		
			
		try:   
			socketIO = SocketIO('localhost', 3000, LoggingNamespace)
			filename = easygui.fileopenbox('Choose file to record to...')
			f = open(filename, 'w')							
			endtime = time.clock() + float(raw_input('Enter runtime (seconds): '))
			while self.hub.running and self.myo.connected and time.clock() < endtime:
				gyro = self.myo.gyroscope
				acc = self.myo.acceleration
				packed = struct.pack('fffffff', time.clock(), gyro.x, gyro.y, gyro.z, acc.x, acc.y, acc.z)
				socketIO.emit('message', [time.clock(), gyro.x, gyro.y, gyro.z, acc.x, acc.y, acc.z])
				toappend = '%f, %f, %f, %f, %f, %f, %f\n' % (time.clock(), gyro.x, gyro.y, gyro.z, acc.x, acc.y, acc.z)
				allt += toappend
				time.sleep(0.02)
		except KeyboardInterrupt:
			print 'Stopped'
		except:
			print 'Unknown error'
		finally:
			f.write(allt)
			f.close()
		
	def train(self):
		X = []
		Y = []
		while 1:
			print '\n1: Load assembly data'
			print '2: Load nonassembly data'
			print '3: Fit'
			print '4: Back'
			option = int(input())
			if option == 1 or option == 2:
				filename = easygui.fileopenbox()
				f = open(filename)
				csvf = csv.reader(f, skipinitialspace=True, delimiter=',', quoting=csv.QUOTE_NONE)
				for line in csvf:
					X.append([float(line[1]), float(line[2]), float(line[3]), float(line[4]), float(line[5]), float(line[6])])
					if(option == 1):
						Y.append(1)
					else:
						Y.append(0)
				f.close()
				print 'Successfully added %s' % filename
			elif option == 3:
				try:
					clf = svm.SVC()
					print clf.fit(X, Y)
					joblib.dump(clf, 'clf.pkl')
				except:
					print 'Error'
			elif option == 4:
				break
			else:
				print 'Invalid input'
	
	def predict(self):
		clf = joblib.load('clf.pkl')
		while 1:
			print '\n1: Predict assembling'
			print '2: Predict nonassembling'
			print '3: Back'
			option = int(input())
			if option == 1 or option == 2:
				try:
					endtime = time.clock() + float(raw_input('Enter runtime (seconds): '))
					counter = 0
					data = []
					Y = []
					while self.hub.running and self.myo.connected and time.clock() < endtime:
						counter += 1
						gyro = self.myo.gyroscope
						acc = self.myo.acceleration
						data.append([gyro.x, gyro.y, gyro.z, acc.x, acc.y, acc.z])
						if option == 1:
							Y.append(1)
						else:
							Y.append(0)
						if counter > 250:
							counter = 0
							result = clf.predict(data)
							print accuracy_score(Y, result)
							data = []
							Y = []
						time.sleep(0.02)
				except KeyboardInterrupt:
					print 'Stopped'
			elif option == 3:
				break
			else:
				print 'Invalid input'
	
if __name__ == "__main__":
	ml = MyoLearn()