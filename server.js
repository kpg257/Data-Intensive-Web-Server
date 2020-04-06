const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const rest = require("./rest.js");
const app = express();

function Server() {
  let pool = mysql.createPool({
    host: 'kshitijdb.ci77rhmokig7.us-east-2.rds.amazonaws.com',
    port: '3306',
    user: 'root',
    password: 'adminadmin',
    database: 'ediss'
  });

  pool.getConnection(function (err, conn) {
    if (err) {
      console.log('Error connecting to MySQL');
      console.log(err);
      process.exit(1);
    } else {
      app.use(bodyParser.urlencoded({extended: true}));
      app.use(bodyParser.json());
      app.use(bodyParser.text());
      let router = express.Router();
      app.use('', router);
      new rest(router, conn);
      app.listen(4000, function () {
        console.log('Server started')
      });
    }
  })
}

new Server();