var parser = require('./parser.js')
var WebSocketServer = new require('ws');
console.log("Start server");
// подключенные клиенты
var clients = {};

// WebSocket-сервер на порту 8081
var webSocketServer = new WebSocketServer.Server({
  port: 8081
});
webSocketServer.on('connection', function(ws) {

  var idClient = Math.random();
  clients[idClient] = ws;
  console.log("новое соединение " + idClient);

  ws.on('message', function(message) {
    //console.log('получено сообщение ' + message);
      parser.parseMessage(message,idClient);
      
      
//    for (var key in clients) {
//      clients[key].send(message*2);
//    }
  });
  
  ws.on('close', function() {
    console.log('соединение закрыто ' + idClient);
    delete clients[idClient];
  });

});
//отправка сообщения клиенту
var sendMessage = function(message,reqObj){
    console.log("MSG for USER: ",message);
    var Error = {Code:0,title:"all ok"}; //ошибка, возвращаемая клиенту
    if(reqObj.Error != undefined) {
        Error = reqObj.Error;
    }
    var answer = {
        IdMessage:reqObj.IdMessage,
        Query:reqObj.Type,
        Error:Error,
        Tables:[{Name:reqObj.Table,Data:message}]
    };
    if(clients[reqObj.idClient]) {
        clients[reqObj.idClient].send(JSON.stringify(answer));
        console.log("send client:",reqObj.idClient,reqObj.IdMessage);
    }
    else{
        console.log("send client: error- Client not exist");
    }


};
module.exports.send = sendMessage;
