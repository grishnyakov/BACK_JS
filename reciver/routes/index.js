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

function splitAndCheckArrayStr(arrStr,db_params) {
    if(arrStr){
        console.log("db_params",db_params);
        let arrayParamsTemp = arrStr.split('&'); // strings params  item as   id=123412
        let Params = {}; // objects  item as  {key: id, {value: 123412, id_danger: 0}
        for(let index in arrayParamsTemp) {
            if(arrayParamsTemp[index].indexOf('=') > -1) {
                let short_name = arrayParamsTemp[index].split('=')[0];
                let value = arrayParamsTemp[index].split('=')[1];
                let id_danger = 0;


                    //step 2 (check parametr on alert)
                    for(let key in db_params) {
                        //console.log("db_params[key]",db_params[key]);

                        if((db_params[key].short_name === short_name) && short_name != "su") { //игнорированрие su

                            // булевые 0 - проблема
                            // булевые 1 - ок

                            if(db_params[key].id_type_parametr == 1) {  //id_type_parametr = 0 - bool 1- diapason

                                if(db_params[key].danger_value_min >= value || db_params[key].danger_value_max <= value)
                                    id_danger = 2; // 2 - AVARIYA
                                else id_danger = 1; // 1 - OK
                            }
                            else {
                                if(value == 0)
                                    id_danger = 2; // 2 - AVARIYA
                                else id_danger = 1; // 1 - OK
                            }

                            break;
                        }
                        else id_danger = 1; // 1 - OK
                    }


                    //push in array
                    Params[short_name] = {
                        value: value,
                        id_danger: id_danger
                    };
                    console.log(Params[short_name]);



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

    /* pre-inserting actions
        1. select * from parametrs (get max and min value)
    */

    let query = "SELECT * FROM parametrs;";
    connection.query(query, function (err, result) {
        if (!err && result) {
            let db_params = result;
            let id_danger_forgroup = 0;
            let Params = splitAndCheckArrayStr(req.params.params,db_params);
            for(let key in Params) {
                if(Params[key].id_danger == 2) {
                    id_danger_forgroup = 2;
                    break;
                }
                else id_danger_forgroup = 1;
            }
            insertQuery(res, Params, id_danger_forgroup);
        }
        else {
            console.error(err);
        }
    });


});


let getValuesStr = function(Params,id_group){
    let str = "";
    //(id_group,type_parametr,value)
    for(let key in Params) {
        if(key !== "id" && key !=="pas") {
            str+="("+id_group+",'"+key+"',"+Params[key].value+","+Params[key].id_danger+"),";
        }
    }
    if(str.length>0)
        str = str.slice(0,-1);
    return str;
};

let insertQuery = function (res, params,id_danger_forgroup) {

    if(params) {
        /*algoritm inserting values:
            1. check existion device
            2. check params on alerts
            3. create group messages( receive type_danger from step 2)
            4. create params into messages with group_id (receive from step 3)
        */

        //step 1
        let queryAuth = "SELECT * FROM devices WHERE id = " + params['id'].value + ";";
        connection.query(queryAuth, function (err, result) {
            if (err) {
                console.error(err.sqlMessage);
                res.sendStatus(401); //401 Unauthorized («не авторизован»)
            }
            else {
                if(result.length > 0) {
                    if (result[0].password ===  params['pas'].value) {
                        console.log("auth device success", result);

                        //step 3
                        //INSERT INTO tbl_name (a,b,c) VALUES(1,2,3),(4,5,6),(7,8,9);
                        let queryInsertGroup = "INSERT INTO groups_message (id_device,id_danger) VALUES ("+params['id'].value+","+id_danger_forgroup+")";

                        connection.query(queryInsertGroup, function (err, result) {
                            if (err) {
                                console.error(err.sqlMessage);
                                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
                            }
                            else {
                                //step 4
                                    if(result) {

                                        let id_group = result.insertId;
                                        console.log(" new id_group:", id_group);
                                        let values = getValuesStr(params, id_group);
                                        let queryInsertValue = "INSERT INTO messages (id_group,type_parametr,value,id_danger) VALUES " + values + ";";
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
                        console.log("AUTH DEVICE FAIL:", result[0].password," != ", params['pas']);
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
