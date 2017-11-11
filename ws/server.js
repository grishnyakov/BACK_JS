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
var sendMessage = function(message,idClient,reqObj){
    
    var Error = {Code:0,title:"all ok"}; //ошибка, возвращаемая клиенту
    
    var answer = {
        IdMessage:reqObj.IdMessage,
        Query:reqObj.Type,
        Error:Error,
        Tables:[{Name:reqObj.Table,Data:message}]
    };
        
    clients[idClient].send(JSON.stringify(answer));
    console.log("send client:",idClient,reqObj.IdMessage);
}
module.exports.send = sendMessage;
