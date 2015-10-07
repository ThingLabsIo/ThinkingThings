// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

'use strict';

var five = require ("johnny-five");
var device = require('azure-iot-device');
var Particle = require("particle-io");

var particleKey = process.env.PARTICLE_KEY || 'YOUR PARTICLE ACCESS TOKEN HERE';
var userId = process.env.TT_USER_ID || 'YOUR THINGING THINGS USER ID HERE';
var hubId = process.env.TT_HUB_ID || 'YOUR THINGING THINGS HUB ID HERE';
var connectionString = process.env.IOTHUB_CONN || 'YOUR IOT HUB DEVICE-SPECIFIC CONNECTION STRING HERE';

console.log("particleKey: " + particleKey);
console.log("userId: " + userId);
console.log("hubId: " + hubId);
console.log("connectionString: " + connectionString);

var client = new device.Client(connectionString, new device.Https());

var sensors = [{
  sensorName: 'D7P003',
  location: 'kitchen'
},
{
  sensorName: 'D7P004',
  location: 'living-room'
}]
// Create a Johnny Five board board instance to represent your Particle Photon
var b1 = new five.Board({
  id: sensors[0].sensorName, 
  io: new Particle({
    token: particleKey,
    deviceId: sensors[0].sensorName
  })
});

var b2 = new five.Board({
  id: sensors[1].sensorName, 
  io: new Particle({
    token: particleKey,
    deviceId: sensors[1].sensorName
  })
});

// Create an array of Johnny Five Boards
var boards = new five.Boards([b1, b2]);
var fahrenheit, celsius, relativeHumidity;

// The board.on() executes the anonymous function when the 
// board reports back that it is initialized and ready.
boards.on("ready", function() {
    console.log("Board connected...");
    
    // |this| is an array-like object containing references
    // to each initialized board.
    this.each(function(board) {

        var hygrometer = new five.Multi({
            controller: "HTU21D",
            board: board,
            freq: 30000 //threshold: 0.5 // Fire a change event if the value changes by 0.5 or more
        });
        
        var sensorName = sensors[0].sensorName;
        var sensorLocation = sensors[0].location;
        
        if(board.id === sensors[1].sensorName) {
            sensorName = sensors[1].sensorName;
            sensorLocation = sensors[1].location;
        }
      
        // BUGBUG: The 'change' event doesn't seem to work right - it gets invoked just like the 
        // data event, regrdless of what the threshold is set to. I have a message into Brian and 
        // Rick from Johnny Five. - D7
        hygrometer.on("data", function() {
            /*
            fahrenheit = this.temperature.fahrenheit;
            celsius = this.temperature.celsius;
            relativeHumidity = this.hygrometer.relativeHumidity;
            */
            var payload, message;
            var messages = new Array();
            
            // Create a JSON payload for the message that will be sent to Azure IoT Hub
            payload = JSON.stringify({
                userId: userId,
                hubId: hubId,
                sensorId: board.id,
                sensorType: 'temperature_F',
                sensorLocation: sensorLocation,
                data: this.temperature.fahrenheit
            });
            // Create the message based on the payload JSON
            message = new device.Message(payload);
            // For debugging purposes, write out the message paylod to the console
            console.log("Sending message: " + message.getData());
            
            messages.push(message);
            
            // Create a JSON payload for the message that will be sent to Azure IoT Hub
            payload = JSON.stringify({
                userId: userId,
                hubId: hubId,
                sensorId: board.id,
                sensorType: 'temperature_C',
                sensorLocation: sensorLocation,
                data: this.temperature.celsius
            });
            // Create the message based on the payload JSON
            message = new device.Message(payload);
            // For debugging purposes, write out the message paylod to the console
            console.log("Sending message: " + message.getData());
            
            messages.push(message);
            
            // Create a JSON payload for the message that will be sent to Azure IoT Hub
            payload = JSON.stringify({
                userId: userId,
                hubId: hubId,
                sensorId: board.id,
                sensorType: 'relativeHumidity',
                sensorLocation: sensorLocation,
                data: this.hygrometer.relativeHumidity
            });
            // Create the message based on the payload JSON
            message = new device.Message(payload);
            // For debugging purposes, write out the message paylod to the console
            console.log("Sending message: " + message.getData());
            
            messages.push(message);
            
            // Send the message to Azure IoT Hub
            client.sendEventBatch(messages, printResultFor('send'));
        });
    });
});

// Monitor notifications from IoT Hub and print them in the console.
setInterval(function(){
    client.receive(function (err, res, msg) {
        if (!err && res.statusCode !== 204) {
            console.log('Received data: ' + msg.getData());
            client.complete(msg, printResultFor('complete'));
        }
        else if (err)
        {
            printResultFor('receive')(err, res);
        }
    });
}, 1000);
    
// Helper function to print results in the console
function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(op + ' error: ' + err.toString());
    if (res && (res.statusCode !== 204)) console.log(op + ' status: ' + res.statusCode + ' ' + res.statusMessage);
  };
}