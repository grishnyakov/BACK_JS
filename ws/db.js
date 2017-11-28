var mysql = require('mysql');
var ws = require('./server.js');
var crypto = require('crypto');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database : "servergprs",
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
    
});



var selectQuery = function(sqlstring,idClient,object)
{
    console.log("Select from DB: " + sqlstring);
        
    con.query(sqlstring, function (err, result) {
        if (err) 
            console.error(err);
        else
            ws.send(result,idClient,object);
    });
   
};
module.exports.selectQuery = selectQuery;

var authUser = function(idClient,object) {
    var login = object.Values[0];
    var password = object.Values[1];
    console.log("User try sign in: " + login,password);
    var quer = "SELECT id FROM users WHERE login='"+login+"' AND password='"+password+"'; ";
    con.query(quer, function (err, result) {
        if (err)
            console.error(err);
        else{
            if(result) {

            }
            else {
                ws.send("Incorrect login or password",idClient,object);
            }
        }
    });
};
module.exports.authUser = authUser;

function createSession(id_user,idClient,object) {
    console.log("login and pass is correct! idUser:",id_user);

    var name = 'scrrap'+idClient;
    var hash = crypto.createHash('md5').update(name).digest('hex');

    console.log("hash",hash);

    var query = "INSERT INTO session (hash,user_id) VALUES (\""+hash+"\", "+id_user+");" ;

    //query+= " SELECT LAST_INSERT_ID();";
    con.query(query, function (err, result) {
        if (err)
            console.error(err);
        else{
            requestSession(hash,idClient,object)
        }
    });
}
function requestSessionByUserId(id_user) {
    console.log("login and pass is correct! Try check exists sessions. idUser:",id_user);
    var quer = "SELECT hash FROM session WHERE user_id='"+id_user+"';" ;
    con.query(quer, function (err, result) {
        if (err)
            console.error(err);
        else{
            if(result)
                createSession(id_user,idClient,object);
            else
        }
    });
}
function requestSession(hash,idClient,object) {
    console.log("login and pass is correct! idUser:",hash);
    var quer = "SELECT * FROM session WHERE hash='"+hash+"';" ;
    con.query(quer, function (err, session) {
        if (err)
            console.error(err);
        else{
                ws.send([session[0].hash,session[0].created_time],idClient,object);
        }
    });
}module.exports.requestSession = requestSession;
function closeSession(hash,idClient,object) {
    console.log("login and pass is correct! idUser:",hash);
    var query = "DELETE FROM session WHERE hash='"+hash+"' LIMIT 1;" ;
    con.query(query, function (err, session) {
        if (err)
            console.error(err);
        else{
            ws.send("OK",idClient,object);
        }
    });
}module.exports.closeSession = closeSession;