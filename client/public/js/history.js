var socket = io.connect();
$( "#backToLobby" ).click(function() {
    window.location.href = '/lobby';
});
// Получаем и выводим игровую статистику
socket.on('stats', function (games, uniqueUsers, activeGames, users) {
    $('#games').text(games);
    $('#unique').text(uniqueUsers);
    $('#active').text(activeGames);
    $('#users').text(users);
});
// Выводим историю игр
socket.on('viewHistory', function (rooms) {
    console.log(rooms);
    $('#history-list').empty();
    rooms.forEach(function(item) {
        if (item.win.user == 'draw'){
            $('#history-list').append('<li class="game-item">' +
                '<span class="opponent" id="opponent">'+  item.owner +'</span>' +
                '<div class="game-separator"></div>' +
                '<span class="opponent" id="opponent">'+  item.opponent +'</span>' +
                '<p class="game-id">id:<span class="blue">' + item.id + '</span></p></li>');
        }else{
            $('#history-list').append('<li class="game-item">' +
                '<span class="winner" id="winner"><i id="win" class="fas fa-check">'+ item.win.user +'</i></span>' +
                '<div class="game-separator"></div>' +
                '<span class="opponent" id="opponent">'+  item.lose.user +'</span>' +
                '<p class="game-id">id:<span class="blue">' + item.id + '</span></p></li>');
        }
    });
});

