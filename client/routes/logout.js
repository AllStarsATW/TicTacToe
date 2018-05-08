exports.post = function(req, res, next) {
    var sid = req.session.id;

    var io = req.app.get('io');
    req.session.destroy(function(err) {
        if (err) return next(err);

        res.redirect('/');
    });
};
