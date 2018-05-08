const mongoose = require('mongoose');
var config = require('server/config/index');
mongoose.connect(config.get('mongoose:uri'), config.get('mongoose:options'));

module.exports = mongoose;