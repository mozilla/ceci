#!/usr/bin/env node

var express = require('express');
var path = require('path');
var fs = require('fs');
var app = express();
var uuid = require('node-uuid');

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.get('/store/uuid', function (req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.send(uuid.v1());
});


app.use('/', express.static(__dirname));



var server = app.listen(process.env.PORT, function (err) {
  console.log('Running on', server.address());
});
