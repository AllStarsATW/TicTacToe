var crypto = require('crypto');
var async = require('async');
var mongoose = require('server/db/mongoose');
var util = require ('util');
var log = require('server/logger/log')(module);
    Schema = mongoose.Schema;
// Схема объекта пользователя для записи в БД
var schema = new Schema({
    username: {
        type: String,
        unique: true,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    email:{
        type: String,
        unique: true,
        required: true
    },
    wins:{
        type: Number,
        default: 0
    },
    loses:{
        type: Number,
        default: 0
    },
    draw:{
        type: Number,
        default: 0
    },
    created: {
        type: Date,
        default: Date.now
    }
});
// Кодировка пароля
schema.methods.encryptPassword = function(password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
};

schema.virtual('password')
    .set(function(password) {
        this._plainPassword = password;
        this.salt = Math.random() + '';
        this.hashedPassword = this.encryptPassword(password);
    })
    .get(function() { return this._plainPassword; });

schema.methods.checkPassword = function(password) {
    return this.encryptPassword(password) === this.hashedPassword;
};
// Получение данных из формы авторизации, поиск по логину в БД (логин уникален), и проверка правильности пароля
schema.statics.authorize = function (username, password, callback) {
    log.info("Авторизация пользователя начата");
    log.debug("Имя пользователя: " + username);
    log.debug("Пароль: " + password);
    var User = this;
    async.waterfall([
            function (callback) {
                log.debug("Поиск пользователя в базе данных...");
                User.findOne({username: username}, callback);
            },
            function (user, callback) {
                if (user) {
                    log.debug("Пользователь найден");
                    log.debug("Проверка пароля");
                    if (user.checkPassword(password)) {
                        log.debug("Пароль верен");
                        callback(null, user);
                    } else {
                        callback(new AuthError("Пароль неверен"));
                    }
                } else {
                    callback(new AuthError("Такого пользователя не существует"));
                }
            }
        ], callback);
    log.info("Пользователь успешно авторизован");
    };
// Получение данных из формы регистрации, проверка по лоигну и почтовому адресу, елси совпадений нет - кодируем пароль и
// заносим пользователя в БД
schema.statics.register = function (username, email, password, callback) {
    var User = this;
    log.info("Регистрация пользователя начата");
    log.debug("Имя пользователя: " + username);
    log.debug("Email: " + email);
    log.debug("Пароль: " + password);
    console.log("Recived email: " + email);
    async.waterfall([
        function (callback) {
            log.debug("Поиск пользователя в базе...");
            User.findOne({username: username}, callback);
        },
        function (user, callback) {
            if (user) {
                callback(new AuthError("Пользователь с таким именем уже существует"));
            } else {
                log.debug("Пользовательское имя свободно");
                User.findOne({email: email}, callback);
            }
        },
        function (checkEmail, callback) {
            log.debug("Проверка почтового ящика...");
            if (checkEmail) {
                callback(new AuthError("Пользователь с таким почтовым адресом уже существует"));
            } else {
                log.debug("Почтовый ящик свободен");
                var user = new User({username: username, email: email, password: password});
                user.save(function (err) {
                    if (err) return callback(err);
                    callback(null, user);
                });
            }
        }
    ], callback);
};
// Получаем пользователя для изменения данных, находим в базе по логину и изменяем, либо число побед, либо число проигрышей,
// либо число игр в ничью в зависимости от параметра result при вызове функции
schema.statics.changeStats = function (username, result, callback) {
    log.info("Изменение данных пользователя начато");
    log.debug("Имя пользователя: " + username);
    log.debug("Результат завершения партии: " + result);
    var User = this;
    async.waterfall([
        function (callback) {
            log.debug("ПОиск пользователя...");
            User.findOne({username: username}, callback);
        },
        function (user, callback) {
            if (user) {
                log.debug("Пользователь найден");
                switch (result){
                    case 'win':
                        log.debug("Увеличение числа побед игрока: " + username);
                        var wins = ++user.wins;
                        User.update({username: username}, {
                            wins: wins
                        }, function(err) {
                            if (err) log.error("Ошибка увеличения числа побед пользователя: " + username);
                        });
                        break;
                    case 'lose':
                        log.debug("Увеличение числа поражений игрока: " + username);
                        var loses = ++user.loses;
                        User.update({username: username}, {
                            loses: loses
                        }, function(err) {
                            if (err) log.error("Ошибка увеличения поражений побед пользователя: " + username);
                        });
                        break;
                    case 'draw':
                        log.debug("Увеличение числа игр в ничью игрока: " + username);
                        var draw = ++user.draw;
                        User.update({username: username}, {
                            draw: draw
                        }, function(err) {
                               if (err) log.error("Ошибка увеличения числа игр в ничью пользователя: " + username);
                        });
                        break;
                }
            } else {
                callback(new AuthError("Такого пользователя не существует"));
            }
        }
    ], callback);
};

exports.User = mongoose.model('User', schema);
// Вывод ошибок авторизации и регистрации
function AuthError(message) {
    Error.apply(this, arguments);
    Error.captureStackTrace(this, AuthError);

    this.message = message;
}

util.inherits(AuthError, Error);

AuthError.prototype.name = 'AuthError';

exports.AuthError = AuthError;