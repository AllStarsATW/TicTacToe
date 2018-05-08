// Клик по кнопке финального всплывающего окна
$( ".end-game" ).click(function() {
    window.location.href = '/lobby';
});
// Передача на изменение финальной статимтики в game.js (public/routes/)
function sendStats(user, result) {
    console.log("Sending data:");
    console.log(user);
    console.log(result);
    $.post('/game',{user: user, result: result});
}
// Запуск таймера ожидания хода для ходящего игрока
function setTimer(id, turn){
    $('#timer').html(30);
    timer = setInterval(function(){
        var i = parseInt($('#timer').html()); i--;
        if (i == 0){
            socket.emit("timeout", id, turn, 'lose');
        }
        $('#timer').html(i);
    }, 1000);
}
// Запуск таймера хода для ожидающего игрока
function setExitTimer(id, turn){
    $('#exit-timer').html(60);
    exitTimer = setInterval(function(){
        var i = parseInt($('#exit-timer').html()); i--;
        if (i == 0){
            socket.emit("timeout", id, turn, 'win');
        }
        $('#exit-timer').html(i);
    }, 1000);
}
// Парсим id комнаты из адреса
var roomID = window.location.pathname;
roomID = roomID.substr(6);
var timer = null, exitTimer = null;
var socket = io();
// При подключении игрока сразу запускаем инициализацию
socket.on('connect', function() {
    $('#roomID').html(roomID);
    $('#status').html('Успешно подключились, игра создана');
    socket.emit('initMe', roomID);
});
$( "#ready" ).click(function() {
    socket.emit('startGame');
});
// Клик по крестику выхода
$( ".exitButton" ).click(function() {
    socket.emit('disconnected', roomID);
    window.location.href = '/lobby';
});
socket.on('reconnect', function () {
    $('#status').html('Переподключились, продолжайте игру');
});
socket.on('reconnecting', function () {
    $('#status').html('Соединение с сервером потеряно, переподключаемся...');
});
socket.on('error', function (e) {
    $('#status').html('Ошибка: ' + (e ? e : 'неизвестная ошибка'));
});
socket.on('wait', function(){
    $('#status').append('... ожидаем соперника...');
});
// Подготовка поля игры к запуску игры, рспределение ролей на первый ход и функция реакции на клик по полю
socket.on('ready', function(id, turn, isMyTurn, room){
    document.getElementById('game-field').style.display='block';
    if (room){
        room.steps.forEach(function (item) {
            var block = document.getElementById(item.step);
            block.classList.remove("free");
            block.classList.add("clicked");
            block.textContent = item.sign;
        });
    }
    if (isMyTurn == true){
        $('#status').html('К вам подключился соперник! Игра началась! Сейчас Ваш первый ход!');
        setTimer(id, turn);
        document.getElementById('timerpanel').style.display='block';
        document.getElementById('mask').style.display='none';
        document.getElementById('ruller-timer').style.display='none';
        document.getElementById('notice').style.display='block';
    }else{
        $('#status').html('К вам подключился соперник! Игра началась! Сейчас ходит соперник!');
        setExitTimer(id, turn);
        document.getElementById('ruller-timer').style.display='block';
        document.getElementById('timerpanel').style.display='none';
        document.getElementById('mask').style.display='block';
        document.getElementById('notice').style.display='none';
    }
    $(".free").click(function (e) {
        clearInterval(timer);
        socket.emit("sendStep", e.target.id, id);
    });
});
// Получение хода из функции выше для ходящего и ожидающего хода
// Проверка на ничью - если набрано 9 ходов (максимально для поля 3х3) - запускаем завершение игры
// Если ходов меньше меняем роли
socket.on('getStepFromServer', function (room, turn, isMyTurn) {
    var step = room.steps[room.steps.length - 1];
    var block = document.getElementById(step.step);
    block.classList.remove("free");
    block.classList.add("clicked");
    block.textContent = step.sign;
    clearInterval(exitTimer);
    clearInterval(timer);
    if (isMyTurn == true){
        if (room.stepCount == 9){
            socket.emit("draw", room.id);
        }
        $('#status').html('Сейчас ваш ход');
        document.getElementById('timerpanel').style.display='block';
        document.getElementById('ruller-timer').style.display='none';
        setTimer(room.id, room.turn);
        document.getElementById('mask').style.display='none';
        document.getElementById('notice').style.display='block';
    }else{
        $('#status').html('Сейчас ходит соперник');
        document.getElementById('ruller-timer').style.display='block';
        setExitTimer(room.id, room.turn);
        document.getElementById('timerpanel').style.display='none';
        document.getElementById('mask').style.display='block';
        document.getElementById('notice').style.display='none';
    }
});
// Отправляем данные для изменения статистики пользователей, вызов происходит 1 раз от активного пользователя
socket.on('sendStats', function (winner, loser, draw) {
    if (draw){
        sendStats(winner, 'draw');
        sendStats(loser, 'draw');
    }else{
        sendStats(winner, 'win');
        sendStats(loser, 'lose');
    }
});
// Вывод завершающего всплывающего окна
socket.on('notice', function(reason, role) {
    clearInterval(timer);
    clearInterval(exitTimer);
    switch(reason) {
        case 'draw':
            $('.modal-title').text("Ничья");
            $('.modal-message').text("Игровое поле полностью заполнено, больше не осталось ходов!");
            $('#modalwindow').modal("show");
            break;
        case 'timeout':
            if (role == "win"){
                $('.modal-title').text("Вы победили");
                $('.modal-message').text("Соперник так и не смог решить как ему ходить! Вы победили!");
                $('#modalwindow').modal("show");
            }else{
                $('.modal-title').text("Вы проиграли");
                $('.modal-message').text("Время на ход закончилось! Вы проиграли!");
                $('#modalwindow').modal("show");

            }
            break;
        case 'leaved':
            $('.modal-title').text("Вы победили");
            $('.modal-message').text("Противник покинул игру!");
            $('#modalwindow').modal("show");
            break;
        case 'finish':
            if (role == "lose"){
                $('.modal-title').text("Вы проиграли");
                $('.modal-message').text("Этот ход стал решающим для вас! Вы проиграли!");
                $('#modalwindow').modal("show");
            }else{
                $('.modal-title').text("Вы победили");
                $('.modal-message').text("Этот ход стал решающим для вас! Вы победили!");
                $('#modalwindow').modal("show");
            }
            break;
        default:
            $('.modal-title').text("Ошибка!");
            $('.modal-message').text("Этот исход игры неизвестен!");
            $('#modalwindow').modal("show");
    }
});
// Получем и выводим игровую статистику
socket.on('stats', function (games, users, activeGames, players) {
    $('#games').text(games);
    $('#unique').text(users);
    $('#active').text(activeGames);
    $('#users').text(players);
});
