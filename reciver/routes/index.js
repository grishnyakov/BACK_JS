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

console.log('receiver is started!');

app.get('/p/:params', function (req, res) {
    console.log('-------------------------------------------NEW CLIENT---------------------------------------------');

    pool.getConnection(function (err, connection) {
        // Соединение извлечено из пула. Обратите внимание, вам не нужно
        // создавать соединение. Пул вернет вам уже существующее свободное соединение
        // или сам создаст новое.
        console.log(new Date().toLocaleString(), 'user connected!');
        if (!err) {
            console.log('connect to db: successful');

            let ip = req.headers["X-Forwarded-For"] || req.connection.remoteAddress;

            console.log(" ip:", ip + " params:", req.params.params);

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
            console.error('connect to db:    FAIL!');
        }


    });


});

// получить строку вида (2143,t1,29,1),(2143,t1u,25,1),(2143,t2,22,1),(2143,t2u,10,1),(2143,ee,1,1),(2143,su,0,1)
let getValuesStr = function (params, id_group) {
    let arrParamsAsString = [];

    //(id_group,type_parametr,value)
    for (let key in params) {
        if(params.hasOwnProperty(key)){
            if (key !== "id" && key !== "pas") {
                arrParamsAsString.push("(" + [id_group, "'"+key+"'", params[key].value, params[key].id_danger] + ")");
            }
        }
        else console.error('error hasOwnProperty getValuesStr:  ',params, key, id_group);

    }

    return arrParamsAsString.toString();
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

//Авторизация устройства
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
                console.log("not found device:", params['id'], 'return 401 Unauthorized');
                res.sendStatus(401); //401 Unauthorized («не авторизован»)
                connection.release();
            }

        }
    });
}

//Создание группы сообщений
function createGroupMessage(res, connection, params, id_danger_for_group) {

    let id_device = params['id'].value;

    //INSERT INTO tbl_name (a,b,c) VALUES(1,2,3),(4,5,6),(7,8,9);
    let queryInsertGroup = "INSERT INTO groups_message (id_device,id_danger) VALUES (" + id_device + "," + id_danger_for_group + ")";
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
                createMessages(res, connection, values, id_device); // step 4
            }
            else {
                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка се
                connection.release();
            }
        }

    });
}

//Запись значений параметров в бд
function createMessages(res, connection, values, id_device) {
    if (values) {
        let queryInsertValue = "INSERT INTO messages (id_group,type_parametr,value,id_danger) VALUES " + values + ";";
        connection.query(queryInsertValue, function (err, result) {
            console.log(queryInsertValue);
            if (err) {
                console.error(err.sqlMessage);
                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
                connection.release();
            }
            else {
                getAndSendDeviceParametrs(res, connection, id_device);
            }

        });
    }
    else {
        console.error("Empty value message");
        connection.release();
    }
}

//Функция для получения и отправки параметров устройства(настроек)
function getAndSendDeviceParametrs(res, connection, id_device) {

    
    let query = `   SELECT short_name, datetime, value, index_param 
                    FROM  device_settings
                    INNER JOIN parametrs ON parametrs.id = device_settings.id_parametr
                    WHERE id_device = '${id_device}'
                    ORDER BY index_param ASC`;

    connection.query(query, function (err, result) {
        if (err) {
            console.error(err.sqlMessage);
            res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка сервера»)
            connection.release();
        }
        else {
            //step 4
            if (result) {
                let strSettings = createSettingsArrayForDevice(result);
                console.log(new Date().toLocaleString(),'RETURN: ',id_device, ":", strSettings);
                res.status(201).send(strSettings);
            }
            else {
                res.sendStatus(500); //500 Internal Server Error («внутренняя ошибка се
            }
            connection.release();
        }

        //Создать массив параметров для устройства
        function createSettingsArrayForDevice(resultQuery) {
            let arrSettings = [];
            const params_count = 5;
            for (let i=0; i < params_count; i++) { // 5 параметров //TODO: нужно доставать из базы число параметров для типа устройства
                let record = getRecordByIndexParam(resultQuery, i);
                if(record)
                    arrSettings.push(record.value);
                else arrSettings.push(-999);
            }

            //Получить строку с нужным index_param
            function getRecordByIndexParam(records,index_param) {
                let item = null;
                for (let index in records) {
                    if (records.hasOwnProperty(index)) {
                        if (records[index].hasOwnProperty('index_param')) {
                            if (records[index].index_param === index_param) {
                                item = records[index];
                                break;
                            }
                        }
                    }
                }
                return item;
            }

            return "gc_response:"+ arrSettings;
        }
    });
}

//Алгоритм опеределения аварии
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


module.exports = app;
