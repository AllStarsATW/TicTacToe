var User = require('server/db/user').User;
var async = require('async');
var HttpError = require('server/logger/index').HttpError;
var AuthError = require('server/db/user').AuthError;
exports.get = function(req, res) {
    res.render('game');
};

exports.post = function (req, res, next) {
    var user = req.body.user;
    var result = req.body.result;
    console.log("Received data");
    console.log(user);
    console.log(result);
User.changeStats(user, result, function (err) {
        if (err) {
            return next(err);
        }
        res.send({});
    });

};

