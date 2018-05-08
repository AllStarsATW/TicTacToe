var User = require('server/db/user').User;
var async = require('async');
var HttpError = require('server/logger/index').HttpError;
var AuthError = require('server/db/user').AuthError;


exports.post = function (req, res, next) {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    console.log("Email: " + email);

    User.register(username, email, password,   function (err, user) {
        if (err) {
            if (err instanceof AuthError) {
                return next(new HttpError(403, err.message));
            } else {
                return next(err);
            }
        }
        req.session.user = user._id;
        res.send({});
    });

};



