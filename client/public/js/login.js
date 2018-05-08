// Файл реакции на формы страницы входа и регистрации
$( "#login" ).submit(function() {
    var form = $(this);

    $('.error', form).html('');
    $(':submit', form).button("loading");
    $.ajax({
        url: "/login",
        method: "POST",
        data: form.serialize(),
        complete: function () {
            $(":submit", form).button("reset");
        },
        statusCode: {
            200: function () {
                $('.modal-title').text("Авторизация");
                $('.modal-message').text("Вы успешно авторизовались на сайте и будете перенаправлены на страницу поиска игр");
                $('#modalwindow').modal("show");
                $('#modalwindow').on("hidden.bs.modal", function (event) {
                    window.location.href = "/lobby";
                });
            },
            403: function (jqXHR) {
                var error = JSON.parse(jqXHR.responseText);
                $('.error', form).html(error.message);
            }
        }
    });
    return false;
});

$( "#registration" ).submit(function() {
    var form = $(this);

    $('.error', form).html('');
    $(':submit', form).button("loading");
    console.log("Отправляю данные");
    $.ajax({
        url: "/registration",
        method: "POST",
        data: form.serialize(),
        complete: function () {
            $(":submit", form).button("reset");
        },
        statusCode: {
            200: function () {
                $('.modal-title').text("Регистрация");
                $('.modal-message').text("Вы успешно зарегистрировались на сайте и будете перенаправлены на страницу поиска игр");
                $('#modalwindow').modal("show");
                $('#modalwindow').on("hidden.bs.modal", function (event) {
                    window.location.href = "/lobby";
                });
            },
            403: function (jqXHR) {
                var error = JSON.parse(jqXHR.responseText);
                $('.error', form).html(error.message);
            }
        }
    });
    return false;
});