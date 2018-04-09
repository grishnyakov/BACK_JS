let express = require('express');
let mysql = require('mysql');
let app = express();
let db_config = {
    host: "localhost",
    user: "root",
    password: "blackhole",
    database: "servergprs",
    port: 3306
};
let connection;

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

function splitArrayStr(arrStr) {
    if(arrStr){
        let arrayParamsTemp = arrStr.split('&'); // strings params  item as   id=123412
        let Params = []; // objects  item as  {key: id, value: 123412}
        for(let index in arrayParamsTemp) {
            if(arrayParamsTemp[index].indexOf('=') > -1) {
                Params[arrayParamsTemp[index].split('=')[0]] = arrayParamsTemp[index].split('=')[1];
            }
            else console.error("splitArrayStr:: BAD PARAMETR:",arrayParamsTemp[index]," i continue...");
        }
        return Params;
    }
    else return null;
}

app.get('/p/:params', function(req, res) {
    let date = new Date();
    date = date.toISOString().replace('T',' ').replace('Z','');
    let ip = req.headers["X-Forwarded-For"] || req.connection.remoteAddress;

    console.log(date," ip:",ip+" APP.GET::",req.params.params);

    let Params = splitArrayStr(req.params.params);

    insertQuery(res, Params);
});


let getValuesStr = function(Params,id_group){
    let str = "";
    //(id_group,type_parametr,value)
    for(let key in Params) {
        if(key !== "id" && key !=="pwd") {
            str+="("+id_group+",'"+key+"',"+Params[key]+"),";
        }
    }
    if(str.length>0)
        str = str.slice(0,-1);
    return str;
};

let insertQuery = function (res, params) {

    if(params) {
        /*algoritm inserting values:
            1. check existion device
            2. create group messages
            3. create params into messages  with group_id (receive from step 2)
        */

        //step 1
        let queryAuth = "SELECT * FROM devices WHERE id = " + params['id'] + ";";
        connection.query(queryAuth, function (err, result) {
            if (err) {
                console.error(err.sqlMessage);
                res.sendStatus(401); //401 Unauthorized («не авторизован»)
            }
            else {
                if(result.length > 0) {
                    if (result[0].password ===  params['pwd']) {
                        console.log("auth device success", result);

                        //step 2
                        //INSERT INTO tbl_name (a,b,c) VALUES(1,2,3),(4,5,6),(7,8,9);
                        let queryInsertGroup = "INSERT INTO groups_message (id_device) VALUES ("+params['id']+")";

                        connection.query(queryInsertGroup, function (err, result) {
                            if (err) {
                                console.error(err.sqlMessage);
                                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
                            }
                            else {
                                //step 3
                                    if(result) {

                                        let id_group = result.insertId;
                                        console.log(" new id_group:", id_group);
                                        let values = getValuesStr(params, id_group);
                                        let queryInsertValue = "INSERT INTO messages (id_group,type_parametr,value) VALUES " + values + ";";
                                        connection.query(queryInsertValue, function (err, result) {
                                            console.log(queryInsertValue);
                                            if (err) {
                                                console.error(err.sqlMessage);
                                                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
                                            }
                                            else {
                                                res.sendStatus(200); //OK - хорошо
                                            }

                                        });

                                    }
                                    else res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка се
                                }

                        });

                    }
                    else {
                        console.log("AUTH DEVICE FAIL:", result[0].password," != ", params['pwd']);
                        res.sendStatus(401); //401 Unauthorized («не авторизован»)
                    }
                }
                else {
                    console.log("not found device:", params['id']);
                }

            }
        });
    }
    else res.sendStatus(403); //
};


module.exports = app;
