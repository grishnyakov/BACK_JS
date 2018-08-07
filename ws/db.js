var mysql = require('mysql');
var ws = require('./server.js');
var crypto = require('crypto');

var db_config = {
    host: "localhost",
    user: "root",
    password: "blackhole",
    database: "servergprs",
    port: 3306
};
var connection;

function handleDisconnect() {
    connection = mysql.createConnection(db_config); // Recreate the connection, since
                                                    // the old one cannot be reused.
    connection.connect(function (err) {              // The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.error('Connecting DB: ', err.message);
            setTimeout(handleDisconnect, 5000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
        else console.log('Connecting DB: OK');
    });                                     // process asynchronous requests in the meantime.
                                            // If you're also serving http, display a 503 error.
    connection.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') { // Connection to the MySQL server is usually
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            //throw err;                                  // server variable configures this)
        }
    });
}
handleDisconnect();


var selectQuery = function (sqlstring, object) {
    console.log("Select to DB: " + sqlstring);

    connection.query(sqlstring, function (err, result) {
        if (err)
            console.error(err);
        else
            ws.send(result, object);
    });

};
module.exports.selectQuery = selectQuery;

var authUser = function (object) {
    var login = object.Values[0];
    var password = object.Values[1];
    console.log("User try sign in: " + login, password);
    var quer = "SELECT id FROM users WHERE login='" + login + "' AND password='" + password + "'; ";
    connection.query(quer, function (err, result) {
        if (err)
            console.error(err);
        else {
            if (result.length > 0) {
                requestSessionByUserId(result[0].id, object);
            }
            else {
//                object.Error = {Code: 1, title: "Incorrect login or password"};
                ws.send({code: 1, description: "Incorrect login or password"}, object);
            }
        }
    });
};
module.exports.authUser = authUser;


//Devices  +
function registerDevice(object) {
    console.log("registerDevice. object:", object);

    var query = "SELECT * FROM devices WHERE id = " + object.Values[1] + " AND password = \"" + object.Values[2] + "\";";

    //query+= " SELECT LAST_INSERT_ID();";
    connection.query(query, function (err, result) {
        if (err)
            console.error(err);
        else {
            if (result.length > 0) {
                if (result[0].id_user == object.Values[0]) {
                    ws.send({
                        status: "ERROR",
                        description: "Это устройство уже привязано к этому пользователю"
                    }, object);
                }
                else {//девайс не закреплён за этим юзером
                    console.log("pass device is corrected. Start update row.", result[0].id_user, object.Values[0]);
                    query = "UPDATE devices SET id_user=" + object.Values[0] + " WHERE  id=" + object.Values[1] + ";";
                    connection.query(query, function (err, result) {
                        if (err) {
                            console.error(err);
                            ws.send({status: "ERROR", description: err.message}, object);
                        }
                        else {
                            if (result.changedRows > 0) {
                                ws.send({status: "OK"}, object);
                            }

                        }
                    });

                }

            }
            else {
                console.error("Pass not corrected:", object, result);
                ws.send({status: "ERROR", description: "Номер устройства или пароль неверный"}, object);
            }

        }
    });
}
module.exports.registerDevice = registerDevice;
//Devices  -


//Session  +
function createSession(id_user, object) {
    console.log("login and pass is correct! createSession idUser:", id_user);

    var name = "csrrap" + object.idClient * Math.random();
    var hash = crypto.createHash('md5').update(name).digest('hex');

    console.log("hash", hash);

    var query = "INSERT INTO session (hash,user_id) VALUES (\"" + hash + "\", " + id_user + ");";

    //query+= " SELECT LAST_INSERT_ID();";
    connection.query(query, function (err, result) {
        if (err)
            console.error(err);
        else {
            requestSession(hash, object)
        }
    });
}
function requestSessionByUserId(id_user, object) {
    console.log("login and pass is correct! Try check exists sessions. idUser:", id_user);
    var quer = "SELECT hash FROM session WHERE user_id='" + id_user + "';";
    connection.query(quer, function (err, result) {
        if (err)
            console.error(err);
        else {
            if (result.length === 0)
                createSession(id_user, object);
            else ws.send(result, object);
        }
    });
}
function requestSession(hash, object) {
    console.log("requestSession hash:", hash);
    var quer = "SELECT * FROM session WHERE hash='" + hash + "';";
    connection.query(quer, function (err, session) {
        if (err)
            console.error(err);
        else {
            if(session.length > 0){
                ws.send({code:0, user_id: session[0].user_id, hash: session[0].hash, time: session[0].created_time}, object);
            }
            else {
                ws.send({code:4, description: "Сессия не существует"}, object);
            }
        }
    });
}
module.exports.requestSession = requestSession;
function closeSession(hash, object) {
    console.log("login and pass is correct! idUser:", hash);
    var query = "DELETE FROM session WHERE hash='" + hash + "' LIMIT 1;";
    connection.query(query, function (err, result) {
        if (err)
            console.error(err);
        else {
            ws.send({code:0}, object);
        }
    });
}
module.exports.closeSession = closeSession;
//Session  -