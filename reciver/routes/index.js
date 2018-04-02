var express = require('express');
var mysql = require('mysql');
var router = express.Router();
var db_config = {
    host: "localhost",
    user: "root",
    password: "",
    database: "servergprs",
    port: 3306
};
var connection;

//http://89.31.33.164:3000/1234567890/321321321/555/444/333/9/9/9


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


router.get('/:number/:pass/:data1/:data2/:data3', function (req, res, next) {
    whoIslient(req);
    var number = req.params.number,
        pass = req.params.pass;
    var params = {
        data1: req.params.data1,
        data2: req.params.data2,
        data3: req.params.data3,
        data4: -999,
        data5: -999,
        data6: -999
    };

    insertQuery(res, number, pass, params);
});

router.get('/:number/:pass/:data1/:data2/:data3/:data4', function (req, res, next) {
    whoIslient(req);
    var number = req.params.number,
        pass = req.params.pass;
    var params = {
        data1: req.params.data1,
        data2: req.params.data2,
        data3: req.params.data3,
        data4: req.params.data4,
        data5: -999,
        data6: -999
    };

    insertQuery(res, number, pass, params);
});

router.get('/:number/:pass/:data1/:data2/:data3/:data4/:data5', function (req, res, next) {
    whoIslient(req);
    var number = req.params.number,
        pass = req.params.pass;
    var params = {
        data1: req.params.data1,
        data2: req.params.data2,
        data3: req.params.data3,
        data4: req.params.data4,
        data5: req.params.data5,
        data6: -999
    };

    insertQuery(res, number, pass, params);
});

router.get('/:number/:pass/:data1/:data2/:data3/:data4/:data5/:data6', function (req, res, next) {
    whoIslient(req);
    var number = req.params.number,
        pass = req.params.pass;
    var params = {
        data1: req.params.data1,
        data2: req.params.data2,
        data3: req.params.data3,
        data4: req.params.data4,
        data5: req.params.data5,
        data6: req.params.data6
    };

    insertQuery(res, number, pass, params);
});


var insertQuery = function (res, number, pass, params) {
    console.log("Insert into db: ", number, pass, params);
    var queryAuth = "SELECT * FROM devices WHERE id = " + number + ";";

    connection.query(queryAuth, function (err, result) {
        if (err) {
            console.error(err.sqlMessage);
            res.sendStatus(401); //401 Unauthorized («не авторизован»)
        }
        else {
            if (result[0].password === pass) {
                console.log("auth device success", result);
                var queryInsert = "INSERT INTO messages (id_dev, dt,data1,data2,data3,data4,data5,data6) VALUES (" +
                    number + "," +
                    "NOW()" + "," +
                    params.data1 + "," +
                    params.data2 + "," +
                    params.data3 + "," +
                    params.data4 + "," +
                    params.data5 + "," +
                    params.data6
                    + ");";
                connection.query(queryInsert, function (err, result) {
                    if (err) {
                        console.error(err.sqlMessage);
                        res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
                    }
                    else {
                        console.log("inserting successful!");
                        res.sendStatus(200); //OK - хорошо
                    }
                });

            }
            else {
                console.log("AUTH DEVICE FAIL:", result[0].password," != ",pass);
                res.sendStatus(401); //401 Unauthorized («не авторизован»)
            }
        }
    });


};
var whoIslient = function (req) {
    var ip = req.headers["X-Forwarded-For"] || req.connection.remoteAddress;
    console.log("Connected client:" + ip, req.params);
}

module.exports = router;
