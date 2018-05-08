var log = require('server/logger/log')(module);
var async = require('async');
var config = require('server/config/index');
var cookieParser = require('cookie-parser');
var sessionStore = require('server/db/sessionStore');
var HttpError = require('server/logger/index').HttpError;
var User = require('server/db/user').User;
const cookie = require('cookie');
var connect = require('connect');
var activeRooms = [], gameHistory = [], countUsers = 0,
    countPlayers = 0;



function loadSession(sid, callback) {
    sessionStore.load(sid, function (err, session) {
        if (arguments.length == 0) {
            return callback(null, null);
        } else {
            return callback(null, session);
        }
    });
}
function loadUser(session, callback) {
    if (!session.user) {
        return callback(null, null);
    }
    User.findById(session.user, function (err, user) {
        if (err) return callback(err);
        if (!user) {
            return callback(null, null);
        }
        callback(null, user);
    })
}



module.exports = function (server) {

    var secret = config.get('session:secret');
    var sessionKey = config.get('session:key');
    var io = require('socket.io').listen(server, {
        logger: {
            debug: log.debug,
            info: log.info,
            error: log.error,
            warn: log.warn
        }
    });

    io.set('origins', 'localhost:*');
    io.use(function (socket, next) {
        var handshakeData = socket.request;
        async.waterfall([
            function (callback) {
                //получить sid
                var parser = cookieParser(secret);
                parser(handshakeData, {}, function (err) {
                    if (err) return callback(err);
                    var sid = handshakeData.signedCookies[sessionKey];
                    loadSession(sid, callback);
                });
            },
            function (session, callback) {
                if (!session) {
                    return callback(new HttpError(401, "No session"));
                }
                socket.handshake.session = session;
                loadUser(session, callback);
            },
            function (user, callback) {
                if (!user) {
                    return callback(new HttpError(403, "Anonymous session may not connect"));
                }
                callback(null, user);
            }
        ], function (err, user) {

            if (err) {
                if (err instanceof HttpError) {
                    return next(new Error('not authorized'));
                }
                next(err);
            }
            socket.handshake.user = user;
            next();
        });
    });

    // Создание обхекта комнаты
    // room.id - id комнаты
    // room.owner - создатель
    // room.opponent - оппонент
    // room.status - текущий статус игры
    // room.userList - пользователи игры
    // room.turns - знаки ходов для каждого пользоватедя (также может понадобиться если развивать историю игр)
    // room.turn - текущий знак хода игры
    // room.steps - история ходов (также может понадобиться если развивать историю игр)
    // room.stepCount - кол-во сделанных ходов, необходимо для проверки и возможно истории
    // room.win - победитель
    function addRoom(roomID) {
        log.debug("Начато создание объекта игры");
        if (arguments.length == 0) {
            log.error("В функцию создания комнаты не передан необходмый параметр id комнаты");
        }else{
            log.debug("Переданные параметры:");
            log.debug("Id комнаты: " + roomID);
            var room = findRoomById(roomID);
            if (room == false){
                room = new Object();
                room.id = roomID;
                room.owner = '';
                room.opponent = '';
                room.status = "free";
                room.userList = [];
                room.turns = [];
                room.turn = 'X';
                room.steps = [];
                room.stepCount = 0;
                room.win = '';
                room.lose = '';
                activeRooms.push(room);
            }else{
                log.error("Такая комната уже существует");
            }
        }
    }
    // Поиск пользователя в переданном списке
    function findUser(username, users) {
        var result = false;
        log.debug("Начато поиск пользователя");
        log.debug("Переданные данные:");
        log.debug("Пользователь: " + username);
        log.debug("Список пользователей комнаты: " + users);
        users.forEach(function(item) {
            if (item == username){
                result = true;
                log.debug("Пользователь найден");
            }
        });
        return result;
    }
    // Поиск игры среди активных по id
    function findRoomById(id) {
        var room = false;
        log.debug("Начато поиск комнаты по id");
        log.debug("Переданные данные:");
        log.debug("Id: " + id);
        activeRooms.forEach(function (item, i) {
            if (item.id == id) {
                room = activeRooms[i];
                log.debug("Комната найдена");
            }
        });
        return room;
    }
    function addOpponent(user, room) {
        log.debug("Начата функция добавления оппнента в игру");
        log.debug("Переданные данные:");
        log.debug("Пользователь: " + user);
        log.debug("Комната: ");
        log.debug(room);
        room.opponent = user;
        room.userList.push(user);
    }
    function addOwner(user, room) {
        log.debug("Начата функция добавления создателя в игру");
        log.debug("Переданные данные:");
        log.debug("Пользователь: " + user);
        log.debug("Комната: ");
        log.debug(room);
        room.owner = user;
        room.userList.push(user);
    }
    function makeTurns(room) {
        log.debug("Начата функция случайного распределения знаков хода");
        log.debug("Переданные данные:");
        log.debug("Комната: ");
        log.debug(room);
        var owner = room.owner, opponent = room.opponent;
        var random = Math.round(Math.random());
        if (random == 1){
            room.turns.push({turn : 'X', user : owner});
            room.turns.push({turn : 'O', user : opponent});
        }else{
            room.turns.push({turn : 'O', user : owner});
            room.turns.push({turn : 'X', user : opponent});
            log.info("Выполнено случайное распределение ходов");
            log.debug(room.turns);
        }
    }
    // Проверка ходит пользователь или нет по знаку хода
    function isTurn(username, turns, turn) {
        log.debug("Начата функция проверки, ходил ли игрок");
        log.debug("Переданные данные:");
        log.debug("Игрок: " + username);
        log.debug("Знак хода: " + turn);
        log.debug("Массив распределения знаков хода в комнате");
        log.debug(turns);
        var user = null;
        turns.forEach(function(item){
            if (turn == item.turn){
                user = item.user;
            }
        });
        var result = (user == username) ? true : false;
        return result;
        }
    function switchTurn(room) {
        log.debug("Начата функция смены знака ходящего");
        if (room.turn == 'X'){
            room.turn = 'O';
        }else{
            room.turn = 'X';
        }
    }
    io.on('connection', function(socket) {
        // при каждом подключении пользователя записываем в переменную его ник, увеличиваем кол-во активных пользователей
        // на сайте и вышем на подключенного событие обновления игровой статистики и активных игр каждые 2 сек.
        var username = socket.handshake.user.get('username');
        countUsers++;
        socket.emit('updateRooms', activeRooms, username);
        socket.emit('viewHistory', gameHistory);
        setInterval(function() {
            io.sockets.emit('stats', gameHistory.length, countUsers, activeRooms.length, countPlayers);
            socket.emit('updateRooms', activeRooms, username);
            socket.emit('viewHistory', gameHistory);
        }, 2000);
        // Незамысловатым на защищенным от совпадения способом генерим id комнаты и подключаем туда пользователя
        // после чего переводим его на страницу игры+id
        socket.on('createRoom', function () {
            log.info("Создание комнаты инициализировано пользователем: " + username);
            var id = [
                Math.ceil(Math.random() * 10),
                (Date.now()) % 1000000
            ].join('-');
            addRoom(id);
            log.info("Создана комната: " + id);
            socket.emit('redirect', id);
        });
        // Подключаем пользователя к уже соществующей комнате
        socket.on('switchRoom', function (id) {
            log.info("Пользователь: " + username + " переходит в комнату: " + id);
            socket.emit('redirect', id);
        });
        // Инициализация пользователя по условию
        // Если в комнате пусто, вошедший - создатель
        // Если в комнате 1 человек, вошедший - оппонент
        // Если в комнате 2 человека, вошелший идет обратно в лобби + ошибка
        socket.on('initMe', function (id) {
            countPlayers++;
            log.info("Начало инициализации пользователя: " + username);
            var room = findRoomById(id);
            switch(room.userList.length){
                case 0:
                    addOwner(username, room);
                    socket.join(room.id);
                    log.info("Пользователь: " + username + " назначен создателем комнаты: " + room.id);
                    socket.emit('wait');
                    break;
                case 1:
                    if (!findUser(username, room.userList)){
                        addOpponent(username, room);
                        socket.join(room.id);
                        log.info("Пользователь: " + username + " назначен оппонентом комнаты: " + room.id);
                        log.debug("Начато случайное присвоение символов хода и смена статуса комнаты");
                        makeTurns(room);
                        room.status = "started";
                        log.info("Игра начата");
                        log.debug("Определение ходящего");
                        var result = isTurn(username, room.turns, room.turn);
                        if (result == true){
                            log.debug("Пеервый ход делает игрок" + username);
                            socket.emit('ready', room.id, room.turn, true);
                            socket.broadcast.to(room.id).emit('ready', room.id, room.turn, false);
                        }else{
                            log.debug("Первый ход делает игрок" + username);
                            socket.emit('ready', room.id, room.turn, false);
                            socket.broadcast.to(room.id).emit('ready', room.id, room.turn, true);
                        }
                    }else{
                        log.info("Создатель игры переподключился к игре");
                        socket.join(room.id);
                        socket.emit('wait');
                    }
                    break;
                case 2:
                    if (!findUser(username, room.userList)){
                        log.error("Была совершена попытка добавить третьего игрока в комнату: " + username);
                    }else{
                        log.info("Оппонент переподключился к игре");
                        socket.join(room.id);
                        log.debug("Определяем, что должен делать оппонент");
                        var result = isTurn(username, room.turns, room.turn);
                        if (result == true){
                            log.debug("Оппонент должен сделать ход");
                            socket.emit('ready', room.id, room.turn, true, room);
                        }else{
                            log.debug("Оппонент ожидает, когда противник сделает ход");
                            socket.emit('ready', room.id, room.turn, false, room);
                        }
                    }
            }
        });
        // Реакция на выход пользователя с сайта, исключительно для игровой статы
        socket.on('disconnect', function () {
            countUsers--;
        });
        // Получение хода от пользователя, проверка на выйгрыш и передача обоим клиентам для отметки на поле
        socket.on('sendStep', function (step, id) {
            log.info("Получаем ход");
            log.debug("Переданный ход:" + step + "из комнаты: " + id);
            var room = findRoomById(id);
            log.debug("Заносим ход вместе со знаком (Х или О) в объект игры");
            room.steps.push({step : step, sign : room.turn});
            room.stepCount++;
            log.info("Определяем, был ли ход решающим");
            if (isWin(room)){
                log.info("Ход стал решающим");
                var loser = null;
                room.turns.forEach(function(item){
                    if (item.user != username){
                        loser = item.user;
                    }
                });
                log.info("Победитель: " + username + "проигравший: " + loser);
                io.to(room.id).emit('getStepFromServer', room, room.turn, false);
                socket.emit('sendStats', username, loser);
                socket.emit('notice', 'finish', "win");
                socket.to(room.id).emit('notice', 'finish', "lose");
                endGame(room, username, 'win');
            }else{
                log.info("Ход не был решающим, меняем роли");
                switchTurn(room);
                result = isTurn(username, room.turns, room.turn);
                if (result == true){
                    socket.emit('getStepFromServer', room, room.turn, true);
                    socket.broadcast.to(room.id).emit('getStepFromServer', room, room.turn, false);
                }else{
                    socket.emit('getStepFromServer', room, room.turn, false);
                    socket.broadcast.to(room.id).emit('getStepFromServer', room, room.turn, true);
                }
            }

        });
        // Завершение игры по истечению одного из таймеров
        socket.on('timeout', function (id, turn, result) {
            log.debug("Запущено событие 'Timeout', переданные данные:");
            log.debug("id комнаты: " + id);
            log.debug("Текущий знак хода: " + turn);
            var room = findRoomById(id), loser = null, winner = null;
            switch (result){
                case 'lose':
                    log.info("Таймер хода игрока: " + username + "достиг нуля");
                    room.turns.forEach(function(item){
                        if (item.turn == turn){
                            loser = item.user;
                        }else{
                            winner = item.user;
                        }
                    });
                    log.debug("Проигравший игрок: " + loser);
                    log.debug("Победитель: " + winner);
                    socket.emit('sendStats', winner, loser);
                    socket.emit('notice', 'timeout', "lose");
                    socket.to(room.id).emit('notice','timeout', "win");
                    break;
                case 'win':
                    log.info("Таймер ожидания противника у игрока: " + username + "достиг нуля");
                    room.turns.forEach(function(item){
                        if (item.turn == turn){
                            loser = item.user;
                        }else{
                            winner = item.user;
                        }
                    });
                    log.debug("loser: " + loser);
                    log.debug("winner: " + winner);
                    socket.emit('sendStats', winner, loser);
                    socket.emit('notice', 'timeout', "win");
                    socket.to(room.id).emit('notice','timeout', "lose");
                    break;
            }
            endGame(room, winner, 'timeout');
        });
        // Завершение игры по причине выхода одного из пользователей путем клика по иконке крестика
        socket.on('disconnected', function (id) {
            log.info("Игрок: " + username + "покинул игру");
            log.debug("Переданные данные:");
            log.debug("id комнаты: " + id);
            var room = findRoomById(id), winner = null;
            room.turns.forEach(function(item){
                if (item.user != username){
                    winner = item.user;
                }
            });
            log.debug("Победитель: " + winner);
            log.debug("Проигравший: " + username);
            socket.emit('sendStats', winner, username);
            socket.to(room.id).emit('notice', 'leaved');
            endGame(room, winner, 'user leaved game');
        });
        // Завершение игры в ничью
        socket.on('draw', function (id) {
            log.info("Игроки завершили партию в ничью");
            log.debug("Переданные данные:");
            log.debug("Комната: " + id);
            var room = findRoomById(id);
            var user = null;
            room.turns.forEach(function(item){
                if (item.user != username){
                    user = item.user;
                }
            });
            socket.emit('sendStats', username, user, true);
            socket.emit('notice', 'draw', "draw");
            socket.to(room.id).emit('notice', 'draw', "draw");
            endGame(room, "draw", 'draw');
        });
        // Функция проверки на победу, возвращает true или false. Для проверки парсим историю ходов и сохранияем только
        // хода текущего пользователя
        function isWin(room) {
            log.info("Начата проверка хода на выйгрышный");
            log.debug("Переданная комната:");
            log.debug(room);
            var steps = [], x,y;
            room.steps.forEach(function (item) {
                if (item.sign == room.turn){
                    x = Number(item.step[0]);
                    y = Number(item.step[2]);
                    steps.push({x : x, y : y});
                }
            });
            log.debug("Выделенные ходы для последнего ходящего:");
            log.debug(steps);
            // Четыре разные проверки на победителя, второй параметр отображает направления проверки
            if (checkWinner(steps, '|') || checkWinner(steps, '-') || checkWinner(steps, '\\') || checkWinner(steps, '/')){
                return true;
            }else{
                return false;

            }
        }
        // Собственно функция динамической проверки на победителя, всего 4 направления: вертикаль (3 возможных варианта),
        // горизонталь (3 возможных варианта), диагональ слева направо (1 вариант), и диагональ справа налево (ну вы поняли)
        function checkWinner(steps, way){
            log.debug("Начата функция динамической проверки на победителя");
            log.debug("Переданные данные:");
            log.debug("Все ходы игрока в партии: " + steps);
            log.debug("Способ проверки: " + way);
            var win = false;
            switch(way){
                case '|':
                    for (var y = 1; y < 4; y++){
                        var result = 0;
                            steps.forEach(function (item) {
                            if (item.y == y){
                                result++;
                            }
                        });
                        if (result == 3){
                            win = true;
                            log.info("Игрок победил, заполнив три клетки по вертикали");
                        }
                    }
                return win;
                break;
                case '-':
                    for (var x = 1; x < 4; x++){
                        var result = 0;
                        steps.forEach(function (item) {
                            if (item.x == x){
                                result++;
                            }
                        });
                        if (result == 3){
                            win = true;
                            log.info("Игрок победил, заполнив три клетки по горизонтали");

                        }
                    }
                    return win;
                    break;
                case '\\':
                    var result = 0;
                    for (var x = 1; x < 4; x++) {
                        var y = x;
                        steps.forEach(function (item) {
                            if ((item.x == x) && (item.y == y)) {
                                result++;
                            }
                        });
                    }
                    if (result == 3) {
                        win = true;
                        log.info("Игрок победил, заполнив три клетки по диагонали слева направо");
                    }
                    return win;
                    break;
                case '/':
                    var result = 0;
                    var y = 3;
                    for (var x = 1; x < 4; x++) {
                        steps.forEach(function (item) {
                            if ((item.x == x) && (item.y == y)) {
                                result++;
                            }
                        });
                        y--;
                    }
                    if (result == 3) {
                        win = true;
                        log.info("Игрок победил, заполнив три клетки по диагонали справа налево");
                    }
                    return win;
                    break;
            }
        }
        // Уводим из комнаты всех пользователей
        function closeRoom(id) {
            log.debug("Начата функция удаления комнаты");
            log.debug("Переданные данные:");
            log.debug("Id комнаты: " + id);
            socket.leave(id);
            socket.broadcast.to(id).leave(id);
            countPlayers--;
            countPlayers--;
            log.info("Комната удалена");
        }
        // Завершаем игру путем переноса объекта игры из массива активных игр в историю, таким образом игра более
        // не фигурирует в лобби
        function endGame(room, winner, reason) {
            loser = null;
            log.debug("Начата функция переноса игры из активных в историю");
            log.debug("Переданные данные:");
            log.debug("Победитель: " + winner);
            log.debug("Причина победы: " + reason);
            log.debug("Комната:");
            log.debug(room);
            if (winner == 'draw'){
                loser = 'draw';
            }else{
            room.userList.forEach(function (item) {
                if (item != winner){
                    loser = item;
                }
            });
            }
            room.win = {user : winner, reason: reason};
            room.lose = {user : loser, reason: reason};
            room.status = "finished";
            var number = null;
            activeRooms.forEach(function(item, i ,err) {
                if (item == room){
                    number = i;
                }
            });
            gameHistory.push(room);
            activeRooms.splice(number, 1);
            closeRoom(room.id);
            log.info("Статус игры изменен на 'finished', игра перенесена из массива активных игр в историю");
        }
    });



};
