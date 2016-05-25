# -*- coding: utf-8 -*-

import socket
import sys
import numpy as np
import matplotlib.pyplot as plt
import threading
import struct
import time

def init_plot():
	global gyroX, gyroY, gyroZ, accX, accY, accZ, newData
	plt.ion()
	fig, ((ax1, ax2, ax3), (ax4, ax5, ax6)) = plt.subplots(nrows=2, ncols=3)
	plt.tight_layout()
	while 1:
		plt.pause(0.02)
		if newData == False:
			continue
		newData = False
		plot(ax1, gyroX, 'Gyroscope X', 500)
		plot(ax2, gyroY, 'Gyroscope Y', 500)
		plot(ax3, gyroZ, 'Gyroscope Z', 500)
		plot(ax4, accX, 'Acceleration X', 5)
		plot(ax5, accY, 'Acceleration Y', 5)
		plot(ax6, accZ, 'Acceleration Z', 5)
		plt.draw()
		
def plot(ax, values, title, ylim):
	ax.clear()
	ax.plot(range(len(values)), values)
	ax.set_title(title, fontsize=16)
	ax.set_ylim([-ylim, ylim])

def init_socket():
	global sock
	sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	server_address = ('localhost', 3000)
	sock.bind(server_address)
	sock.listen(1)
	
def data_listener():
	global sock, gyroX, gyroY, gyroZ, accX, accY, accZ, newData
	gyroX = [0] * 100
	gyroY = [0] * 100
	gyroZ = [0] * 100
	accX = [0] * 100
	accY = [0] * 100
	accZ = [0] * 100
	newData = False
	while 1:
		conn, addr = sock.accept()
		print 'Connection from %s' % str(addr)
		while 1:
			values = conn.recv(40)
			if not values:
				break
			newData = True
			unpacked = struct.unpack('fffffff', values)
			gyroX[:-1] = gyroX[1:]
			gyroY[:-1] = gyroY[1:]
			gyroZ[:-1] = gyroZ[1:]
			accX[:-1] = accX[1:]
			accY[:-1] = accY[1:]
			accZ[:-1] = accZ[1:]
			gyroX[-1] = unpacked[1]
			gyroY[-1] = unpacked[2]
			gyroZ[-1] = unpacked[3]
			accX[-1] = unpacked[4]
			accY[-1] = unpacked[5]
			accZ[-1] = unpacked[6]
		conn.close()
	sock.close()
		
if __name__ == '__main__':
	init_socket()
	thread = threading.Thread(target=data_listener)
	thread.daemon = True
	thread.start()	
	init_plot()
			