var checkAuth = require('server/middleware/checkAuth');

module.exports = function (app) {
    app.get('/', require('./frontpage').get);
    app.get('/login', require('./login').get);
    app.post('/login', require('./login').post);
    app.post('/logout', require('./logout').post);
    app.post('/registration', require('./registration').post);
    app.get('/lobby', checkAuth, require('./lobby').get);
    app.get('/profile', checkAuth, require('./profile').get);
    app.get('/game/:id', checkAuth, require('./game').get);
    app.post('/game', checkAuth, require('./game').post);
    app.get('/history', checkAuth, require('./history').get);
};


