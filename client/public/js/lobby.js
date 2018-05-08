var socket = io.connect();
$( "#create" ).click(function() {
    socket.emit('createRoom');
});
$( "#history" ).click(function() {
    window.location.href = '/history';
});
// Получаем и выводим игровую статистику
socket.on('stats', function (games, uniqueUsers, activeGames, users) {
    $('#games').text(games);
    $('#unique').text(uniqueUsers);
    $('#active').text(activeGames);
    $('#users').text(users);
});
// Выполняем переход в игровую комнату по урлу /game/id комнаты
socket.on('redirect', function (room) {
    window.location.href = '/game/' + room;
});
// Выводим доступные комнаты для игры в соответвующем месте, причем админы и оппоненты уже созданных или даже
// запущенных игр увсе равно видят игры, нужно это для реконнекта в игру
socket.on('updateRooms', function (rooms, user) {
    $('#games-list').empty();
    rooms.forEach(function(item) {
        if ((item.status != 'free') && (user != item.owner) && (user != item.opponent)){
            return;
        } else{
            $('#games-list').append('<li class="game-item"><a href="#" onclick="switchRoom(\''+item.id+'\')">' +
                '<p>Создатель:</p><p class="blue">' + item.owner + '</p>' +
                '<p class="game-id">id:<span class="blue">' + item.id + '</span></p></a></li>');
        }
    });
});
// Запуск события перехода в комнату по клику на его элемент
function switchRoom(id){
    socket.emit('switchRoom', id);
}
