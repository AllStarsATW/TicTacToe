var express = require('express');
var http = require('http');
var path = require('path');
var config = require('server/config/index');
var log = require('server/logger/log')(module);
var HttpError = require('server/logger/index').HttpError;
var mongoose = require('server/db/mongoose');


var app = express();
app.set('port', config.get('port'));
app.engine('ejs', require('ejs-locals'));
app.set('views', __dirname + '/client/public/templates');
app.set('view engine', 'ejs');


app.use(express.favicon());
if (app.get('env') == 'development'){
    app.use(express.logger('dev'));
} else {
    app.use(express.logger('default'));
}
app.use(express.bodyParser());
app.use(express.cookieParser());
var sessionStore = require('server/db/sessionStore');
app.use(express.session({
    secret: config.get('session:secret'),
    key: config.get('session:key'),
    cookie: config.get('session:cookie'),
    store: sessionStore
}));


app.use(require('server/middleware/sendHttpError'));
app.use(require('server/middleware/loadUser'));
app.use(app.router);
require('client/routes/index')(app);
app.use(express.static(path.join(__dirname, '/client')));

app.use(function (err, req, res, next) {
    if (typeof err == 'number') {
        err = new HttpError(err);
    }
    if (err instanceof HttpError) {
        res.sendHttpError(err);
    } else {
        if (app.get('env') == 'development') {
            express.errorHandler()(err, req, res, next);
        } else {
            log.error(err);
            err = new HttpError(500);
            res.sendHttpError(err);
        }
    }
});


var server = http.createServer(app);
server.listen(config.get('port'), function () {
    log.info('Express server listening on port ' + config.get('port'));
});

var io = require('./server/socket/index')(server);

app.set('io', io);
