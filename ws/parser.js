var db = require('./db');

var parseMessage = function(message,idClient) {
    try {
        var arrayObjects = JSON.parse(message);
        console.log(message);
        arrayObjects.forEach(function (object) {
            switch (object.Table) {


                case "messages":
                    switch (object.Type) {
                        case "SELECT":
                            SelectMessages(object, idClient);
                            break;
                        default:
                            console.error("error parse type", object.Type);
                            break;
                    }
                    break; //case "messages"


                case "devices":
                    switch (object.Type) {
                        case "SELECT":
                            SelectDevices(object, idClient);
                            break;
                        default:
                            console.error("error parse type", object.Type);
                            break;
                    }
                    break; //case "devices"

                case "auth":
                    switch (object.Type) {
                        case "SELECT": //запрос на аутенцификацию
                            AuthUser(object, idClient);
                            break;
                        default:
                            console.error("error parse type", object.Type);
                            break;
                    }
                    break; //case "devices"

                default:
                    console.error("error parse Table", object.Table);
                    break;
            }
        });
    }
    catch(err){
        console.error("error json parse: ",err);
    }
};
module.exports.parseMessage = parseMessage;
            

//Messages +
var SelectMessages = function(object,idClient){
    switch(object.Mode){
        case "IdDeviceArray":  
            db.selectQuery("SELECT * FROM messages "+
             generateWhere(object.Values,"id_dev")+
             " LIMIT "+object.Limit,
                    idClient,
                    object);
        break;
        default: console.error("error parse mode",object.Mode); break;
    }                     
};
//Messages -

//Devices +
var SelectDevices = function(object,idClient){
    switch(object.Mode){
        case "IdUsersArray":  
            db.selectQuery("SELECT * FROM devices "+
             generateWhere(object.Values,"id_user")+
             " LIMIT "+object.Limit,
                    idClient,
                    object);
        break;
        default: console.error("error parse mode",object.Mode); break;
    }                     
};
//Devices -                    

var AuthUser = function (object,idClient) {
    switch(object.Mode){
        case "in"://вход юзера
            var str = "SELECT * FROM users WHERE login='"
                +object.Values[0]+"' AND password='"+object.Values[1]+"'";
            db.selectQuery(str,
                idClient,
                object);
            break;
        default: console.error("error parse mode",object.Mode); break;
    }
};
      
var generateWhere = function(arrayId,columnName){
    if(arrayId.length > 0)
        {
            var whereSTR = " WHERE ";
            for(var i =0; i<arrayId.length; i++){
                    whereSTR += columnName + " = " + arrayId[i];
                    if(i+1 < arrayId.length)
                         whereSTR += " OR ";  
            }
            return whereSTR;
        }
    return "error generateWhere";
};

                    
                    
//
//    var message_toserver = {
//        IdMessage: counterMessage++,
//        Table: "messages",
//        Mode: "IdDevice",
//        Values: outgoingMessage,
//        Type: "SELECT",
//        Limit: 100
//    }
