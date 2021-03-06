/* Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const fs = require("fs");
const http = require("http");
const nunjucks = require('nunjucks');
const WebSocket = require('ws');

const task_directory_name = 'task'

const PORT = process.env.PORT || 3000;

// Initialize app
const app = express()
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

nunjucks.configure(task_directory_name, {
    autoescape: true,
    express: app
});

// ======================= <Socket> =======================

// Start a socket to make a connection between the world and
const server = http.createServer(app)
const wss = new WebSocket.Server(
  {server}
);

// Socket used for speaking to the world
var world_socket = null;

// Handles sending a message through the socket
function _send_message(event_name, event_data) {
  if (world_socket) {
    world_socket.send(JSON.stringify({
      type: event_name,
      content: event_data
    }));
  } else {
    console.log('Message recieved without world connected');
    console.log(event_data);
  }
}

// Register handlers
wss.on('connection', function (socket) {
  console.log('Client connected');
  // Disconnects are logged
  socket.on('disconnect', function () {
    console.log('World disconnected');
  });

  socket.on('message', function (data) {
    data = JSON.parse(data)
    if (data['type'] == 'world_alive') {
      world_socket = socket;
    }
  });

  socket.send(JSON.stringify(
    {'type': 'conn_success', 'content': 'Socket is open!'}
  ));
});

server.listen(PORT, function() {
  console.log('Listening on %d', server.address().port);
})

// ----- Messenger routing functions -----
// Verify webhook
app.get('/webhook', async function (req, res) {
  // webhook verification token
  let VERIFY_TOKEN = "Messenger4ParlAI"

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {

    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Send messages through webhook
app.post('/webhook', async function (req, res, next) {
  let body = req.body;
  console.log(body);
  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    _send_message('new_packet', req.body);
    // TODO handle v. rare cases of message drops - should send timeout status
    res.status(200).send('Successful POST');
  } else {
    res.sendStatus(404);
  }
});
