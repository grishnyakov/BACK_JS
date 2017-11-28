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



var selectQuery = function(sqlstring,object)
{
    console.log("Select from DB: " + sqlstring);
        
    con.query(sqlstring, function (err, result) {
        if (err) 
            console.error(err);
        else
            ws.send(result,object);
    });
   
};
module.exports.selectQuery = selectQuery;

var authUser = function(object) {
    var login = object.Values[0];
    var password = object.Values[1];
    console.log("User try sign in: " + login,password);
    var quer = "SELECT id FROM users WHERE login='"+login+"' AND password='"+password+"'; ";
    con.query(quer, function (err, result) {
        if (err)
            console.error(err);
        else{
            if(result.length>0) {
                requestSessionByUserId(result[0].id,object);
            }
            else {
                object.Error ={Code:1,title:"Incorrect login or password"};
                ws.send([],object);
            }
        }
    });
};
module.exports.authUser = authUser;

function createSession(id_user,object) {
    console.log("login and pass is correct! createSession idUser:",id_user);

    var name = "csrrap"+object.idClient*Math.random();
    var hash = crypto.createHash('md5').update(name).digest('hex');

    console.log("hash",hash);

    var query = "INSERT INTO session (hash,user_id) VALUES (\""+hash+"\", "+id_user+");" ;

    //query+= " SELECT LAST_INSERT_ID();";
    con.query(query, function (err, result) {
        if (err)
            console.error(err);
        else{
            requestSession(hash,object)
        }
    });
}
function requestSessionByUserId(id_user,object) {
    console.log("login and pass is correct! Try check exists sessions. idUser:",id_user);
    var quer = "SELECT hash FROM session WHERE user_id='"+id_user+"';" ;
    con.query(quer, function (err, result) {
        if (err)
            console.error(err);
        else{
            if(result.length == 0)
                createSession(id_user,object);
            else ws.send(result,object);
        }
    });
}
function requestSession(hash,object) {
    console.log("requestSession hash:",hash);
    var quer = "SELECT * FROM session WHERE hash='"+hash+"';" ;
    con.query(quer, function (err, session) {
        if (err)
            console.error(err);
        else{
                ws.send({user_id:session[0].user_id,hash:session[0].hash,time:session[0].created_time},object);
        }
    });
}module.exports.requestSession = requestSession;
function closeSession(hash,object) {
    console.log("login and pass is correct! idUser:",hash);
    var query = "DELETE FROM session WHERE hash='"+hash+"' LIMIT 1;" ;
    con.query(query, function (err, session) {
        if (err)
            console.error(err);
        else{
            ws.send(["OK"],object);
        }
    });
}module.exports.closeSession = closeSession;