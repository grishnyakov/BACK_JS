var mysql = require('mysql');
var ws = require('./server.js');

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



var selectQuery = function(sqlstring,idClient,object)
{
    console.log("Select from DB: " + sqlstring);
        
    con.query(sqlstring, function (err, result) {
        if (err) 
            console.error(err);
        else
            ws.send(result,idClient,object);
    });
   
};
module.exports.selectQuery = selectQuery;
