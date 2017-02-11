var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var cp = require('child_process');
var responseTime = require('response-time');
var helmet = require('helmet');
var RateLimit = require('express-rate-limit');
var assert = require('assert');

var config = require('./config');
var users = require('./routes/users');
var session = require('./routes/session');
var sharedNews = require('./routes/sharedNews');

var app = express();
app.enable('trust proxy');

var limiter = new RateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    delayMs: 0
});;

app.use(limiter);

app.use(helmet());
app.use(helmet.csp({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'ajax.googleapis.com', 'maxcdn.bootstrapcdn.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'maxcdn.bootstrapcdn.com'],
        fontSrc: ["'self'", 'maxcdn.bootstrapcdn.com'],
        imgSrc: [' * ']
    }
}));

app.use(responseTime());


app.use(logger('dev'));

app.use(bodyParser.json({ limit: '100kb'}));

app.use(bodyParser.urlencoded({ extended: false}));

app.use(express.static(path.join(__dirname, 'static')));

//var node2 = cp.fork('./app_FORK.js');
// node2.on('exit', function(code){
//     node2 = undefined;
//     node2 = cp.fork('./worker/app_FORK.js', [], { execArgv: ['--debug=5859'] });
// });
var node2 = cp.fork('./worker/app_FORK.js', [], { execArgv: ['--debug=5859'] });

var db = {};
var MongoClient = require('mongodb').MongoClient;

MongoClient.connect(config.MONGODB_CONNECT_URL, function(err, dbConn){
    assert.equal(null, err);
    db.dbConnection = dbConn;
    db.collection = dbConn.collection('newswatcher');
    console.log("Connected to MongoDB server");
});

app.use(function(req, res, next){
    req.db = db;
    req.node2 = node2;
    next();
});

app.get('/', function(req, res){
    //console.log('Send message on get request');
    res.render('index.html');
});

//Rest API 
app.use('/api/users', users);
app.use('/api/sessions', session);
app.use('/api/sharednews', sharedNews);

//catch 404 and forward to error handler
app.use(function(req, res, next){
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

if(app.get('env') === 'development'){
    app.use(function(err, req,res, next){
        res.status(err.status || 500).json({ message: err.toString(), error: err });
        console.log(err);
    });
}

app.use(function(err, req,res, next){
    res.status(err.status || 500).json({ message: err.toString(), error: {}});
    console.log(err);
});

app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function(){
    console.log('Express server listening on port: ' + server.address().port);
});