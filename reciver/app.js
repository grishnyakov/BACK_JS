var express = require('express');
var index = require('./routes/index');
var app = express()
app.use('/', index);
module.exports = app;
