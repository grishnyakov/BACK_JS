let express = require('express');
let app = express();


let mysql = require('mysql');
let db_config = {
    host: "localhost",
    user: "root",
    password: "blackhole",
    database: "servergprs",
    port: 5502
};
let pool = mysql.createPool(db_config);


function splitAndCheckArrayStr(arrStr, db_params) {
    if (arrStr) {
        //console.log("db_params", db_params);
        let arrayParamsTemp = arrStr.split('&'); // strings params  item as   id=123412
        let Params = {}; // objects  item as  {key: id, {value: 123412, id_danger: 0}
        for (let index in arrayParamsTemp) {
            if (arrayParamsTemp[index].indexOf('=') > -1) {
                let short_name = arrayParamsTemp[index].split('=')[0];
                let value = arrayParamsTemp[index].split('=')[1];
                let id_danger = 0;
                //step 2 (check parametr on alert)
                for (let key in db_params) {
                    //console.log("db_params[key]", db_params[key]);

                    if (db_params[key].short_name === short_name && short_name != "su") { //игнорирование su

                        // булевые 0 - проблема
                        // булевые 1 - ок


                        if (db_params[key].id_type_parametr == 1) {  //id_type_parametr = 0 - bool 1- diapason

                            if (db_params[key].danger_value_min >= value || db_params[key].danger_value_max <= value)
                                id_danger = 2; // 2 - AVARIYA
                            else id_danger = 1; // 1 - OK
                        }
                        else {
                            if (value == 0)
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
                //console.log(Params[short_name]);
            }
            else console.error("splitArrayStr:: BAD PARAMETR:", arrayParamsTemp[index], " i continue...");
        }
        return Params;
    }
    else return null;
}

app.get('/p/:params', function (req, res) {


    pool.getConnection(function (err, connection) {
        // Соединение извлечено из пула. Обратите внимание, вам не нужно
        // создавать соединение. Пул вернет вам уже существующее свободное соединение
        // или сам создаст новое.
        let date = new Date();
        if(!err){
            console.log(date,'connected!');
            date = date.toISOString().replace('T', ' ').replace('Z', '');
            let ip = req.headers["X-Forwarded-For"] || req.connection.remoteAddress;

            console.log(date, " ip:", ip + " APP.GET::", req.params.params);

            /* pre-inserting actions
                1. select * from parametrs (get max and min value)
            */

            let query = "SELECT * FROM parametrs;";
            connection.query(query, function (err, result) {
                if (!err && result) {
                    let db_params = result;
                    let id_danger_for_group = 0;
                    let Params = splitAndCheckArrayStr(req.params.params, db_params);
                    for (let key in Params) {
                        if (Params[key].id_danger == 2) {
                            id_danger_for_group = 2;
                            break;
                        }
                        else id_danger_for_group = 1;
                    }
                    insertQuery(res, connection, Params, id_danger_for_group);
                }
                else {
                    console.error(err);
                    connection.release();
                }
            });
        }
        else {
            console.error(date,'cannot create connect');
        }


    });


});


let getValuesStr = function (Params, id_group) {
    let str = "";
    //(id_group,type_parametr,value)
    for (let key in Params) {
        if (key !== "id" && key !== "pas") {
            str += "(" + id_group + ",'" + key + "'," + Params[key].value + "," + Params[key].id_danger + "),";
        }
    }
    if (str.length > 0)
        str = str.slice(0, -1);
    return str;
};

let insertQuery = function (res, connection, params, id_danger_for_group) {

    if (params) {
        /*algoritm inserting values:
            1. check existion device
            2. check params on alerts
            3. create group messages( receive type_danger from step 2)
            4. create params into messages with group_id (receive from step 3)
        */
        checkExistDevice(res, connection, params, id_danger_for_group);
    }
    else {
        res.sendStatus(403);
        connection.release();
    } //
};


function checkExistDevice(res, connection, params, id_danger_for_group) {
    //step 1
    let queryAuth = "SELECT * FROM devices WHERE id = " + params['id'].value + ";";
    connection.query(queryAuth, function (err, result) {
        if (err) {
            console.error(err.sqlMessage);
            res.sendStatus(401); //401 Unauthorized («не авторизован»)
            connection.release();
        }
        else {
            if (result.length > 0) {
                if (result[0].password === params['pas'].value)
                    createGroupMessage(res, connection, params, id_danger_for_group); //step 3
                else {
                    console.log("AUTH DEVICE FAIL:", result[0].password, " != ", params['pas']);
                    res.sendStatus(401); //401 Unauthorized («не авторизован»)
                    connection.release();
                }
            }
            else {
                console.log("not found device:", params['id']);
                connection.release();
            }

        }
    });
}

function createGroupMessage(res, connection, params, id_danger_for_group) {
    //INSERT INTO tbl_name (a,b,c) VALUES(1,2,3),(4,5,6),(7,8,9);
    let queryInsertGroup = "INSERT INTO groups_message (id_device,id_danger) VALUES (" + params['id'].value + "," + id_danger_for_group + ")";
    connection.query(queryInsertGroup, function (err, result) {
        if (err) {
            console.error(err.sqlMessage);
            res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
            connection.release();
        }
        else {
            //step 4
            if (result) {
                let id_group = result.insertId;
                console.log(" new id_group:", id_group);
                let values = getValuesStr(params, id_group);
                createMessages(res, connection, values); // step 4
            }
            else res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка се
        }

    });

}

function createMessages(res, connection, values) {
    if (values) {
        let queryInsertValue = "INSERT INTO messages (id_group,type_parametr,value,id_danger) VALUES " + values + ";";
        connection.query(queryInsertValue, function (err, result) {
            console.log(queryInsertValue);
            if (err) {
                console.error(err.sqlMessage);
                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
            }
            else {
                res.status(201).send("gc_response:20,25,1,0,0");
            }
            connection.release();
        });
    }
    else {
        console.error("Empty value message");
        connection.release();
    }
}

module.exports = app;
