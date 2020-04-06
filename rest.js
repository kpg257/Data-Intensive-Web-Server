const session = require('express-session');
const uuid = require('uuid');
const redis = require("redis");
const redisStore = require('connect-redis')(session);
const client = redis.createClient();

function Rest(router, conn) {

  let appSession = {
    secret: "secretKey",
    store: new redisStore({
      host: 'ediss-rediscluster.jset5n.ng.0001.use2.cache.amazonaws.com',
      port: 6379,
      client: client,
      ttl: 260,
    }),
    rolling: true,
    cookie: {
      maxAge: 15 * 60 * 1000
    },
    resave: true,
    saveUninitialized: true
  };

  router.use(session(appSession));

  router.get('/health-check', (req, res) => {
    myLogger('api: health-check');
    res.json({status: "OK"});
  });

  router.post('/registerUser', (req, res) => {
    myLogger('api: registerUser');
    let {username, password, fname, lname, address, city, state, zip, email} = getParams(req.body);

    checkFields(username, password, fname, lname, address, city, state, zip, email, res) &&
    createUser(username, password, fname, lname, address, city, state, zip, email, res);
  });

  router.post('/login', (req, res) => {
    myLogger('api: login');
    let username = req.body.username || "";
    let password = req.body.password || "";

    isValid(username, password, res) && login(username, password, res, req);
  });

  router.post('/logout', (req, res) => {
    myLogger('api: logout');
    isAuthenticated(req, res) && logout(req, res);
  });

  router.post('/updateInfo', (req, res) => {
    myLogger('api: updateInfo');
    isAuthenticated(req, res) && updateUser(req, res);
  });

  router.post('/addProducts', (req, res) => {
    myLogger('api: addProducts');
    isAdmin(req, res) && addProduct(req, res);
  });

  router.post('/modifyProduct', (req, res) => {
    myLogger('api: modifyProduct');
    isAdmin(req, res) && modifyProduct(req, res);
  });

  router.post('/viewUsers', (req, res) => {
    myLogger('api: viewUsers');
    isAdmin(req, res) && viewUsers(req, res);
  });

  router.post('/viewProducts', (req, res) => {
    myLogger('api: viewProducts');
    viewProducts(req, res);
  });

  router.post('/buyProducts', (req, res) => {
    myLogger('api: buyProducts');
    isAuthenticated(req, res) && buyProducts(req, res);
  });

  router.post('/productsPurchased', (req, res) => {
    myLogger('api: productsPurchased');
    isAdmin(req, res) && productsPurchased(req, res);
  });

  router.post('/getRecommendations', (req, res) => {
    myLogger('api: getRecommendations');
    isAuthenticated(req, res) && getRecommendations(req, res);
  });

  let logout = (req, res) => {
    req.session.destroy();
    res.json({message: "You have been successfully logged out"});
  };

  let isAuthenticated = (req, res) => {
    return req.session.authenticated || notLoggedIn(res);
  };

  let notLoggedIn = (res) => {
    res.json({message: "You are not currently logged in"});
    return false;
  };

  let isValid = (username, password, res) => {
    return (username && password) || loginFailed(res);
  };

  let loginFailed = (res) => {
    res.json({message: "There seems to be an issue with the username/password combination that you entered"});
    return false;
  };

  let login = (username, password, res, req) => {
    let query = "select id, fname, isAdmin from user where username = '" + username
      + "' and password = '" + password + "'";
    conn.query(query, (err, rows) => {
      if (err || !rows.length) {
        myLogger(err, 0);
        res.json({message: "There seems to be an issue with the username/password combination that you entered"});
        return;
      }
      let user = rows[0];
      req.session.isAdmin = !!user.isAdmin;
      req.session.userId = user.id;
      req.session.username = username;
      req.session.authenticated = true;
      let fname = user.fname;
      myLogger('logged in ' + fname, 1);
      res.json({message: "Welcome " + fname});
    });
  };

  let getParams = (body) => {
    let username = body.username || "";
    let password = body.password || "";
    let fname = body.fname || "";
    let lname = body.lname || "";
    let address = body.address || "";
    let city = body.city || "";
    let state = body.state || "";
    let zip = body.zip || "";
    let email = body.email || "";
    return {username, password, fname, lname, address, city, state, zip, email};
  };

  let checkFields = (username, password, fname, lname, address, city, state, zip, email, res) => {
    return (username && password && fname && lname && address && city && state && zip && email && res) ||
      registrationFailed(res);
  };

  let registrationFailed = (res) => {
    res.json({message: "The input you provided is not valid"});
    return false;
  };

  let createUser = (username, password, fname, lname, address, city, state, zip, email, res) => {
    let query = "insert into user (username, password, fname, lname, address, city, state, zip, email," +
      " isAdmin) values('" + username + "', '" + password + "', '" + fname + "', '" + lname + "', '" +
      address + "', '" + city + "', '" + state + "', '" + zip + "', '" + email + "', 0);";

    conn.query(query, (err) => {
      if (err) {
        myLogger(err, 0);
        res.json({message: "The input you provided is not valid"});
        return;
      }
      myLogger("user created: " + username, 1);
      res.json({message: fname + " was registered successfully"});
    });
  };

  let updateUser = (req, res) => {
    let params = ['username', 'password', 'fname', 'lname', 'address', 'city', 'state', 'zip', 'email'];
    let strings = [];

    for (let i = 0; i < params.length; i++) {
      let field = params[i];
      let value = req.body[field];
      if (value) {
        strings.push(field + " = '" + value + "'");
      }
    }

    let userId = req.session.userId;
    let query = "update user set " + strings.join(", ") + " where id = " + userId + ";";

    conn.query(query, (err) => {
      if (err) {
        myLogger(err, 0);
        res.json({message: "The input you provided is not valid"});
        return;
      }

      myLogger('user id: ' + userId, 1);
      returnUpdateSuccess(userId, res);
    });
  };

  let returnUpdateSuccess = (userId, res) => {
    let query = "select fname from user where id = " + userId + ";";
    conn.query(query, (err, rows) => {
      if (err || !rows.length) {
        res.json({message: "The input you provided is not valid"});
        return;
      }
      res.json({message: rows[0].fname + " your information was successfully updated"});
    });

  };

  let isAdmin = (req, res) => {
    return isAuthenticated(req, res) && checkAdmin(req, res);
  };

  let checkAdmin = (req, res) => {
    return req.session.isAdmin || notAdminUser(res);
  };

  let notAdminUser = (res) => {
    res.json({message: "You must be an admin to perform this action"});
    return false;
  };

  let addProduct = (req, res) => {
    let body = req.body;
    let asin = body.asin || "";
    let productName = body.productName || "";
    let productDescription = body.productDescription || "";
    let group = body.group || "";

    if (!asin || !productName || !productDescription || !group) {
      res.json({message: "The input you provided is not valid"});
      return;
    }

    let query = "insert into product values('" + asin + "', '" + productName + "', '" + productDescription
      + "', '" + group + "');";

    conn.query(query, (err) => {
      if (err) {
        myLogger(err, 0);
        res.json({message: "The input you provided is not valid"});
        return;
      }
      myLogger('product name: ' + productName, 1);
      res.json({message: productName + " was successfully added to the system"});
    });
  };

  let modifyProduct = (req, res) => {
    let body = req.body;
    let asin = body.asin || "";
    let productName = body.productName || "";
    let productDescription = body.productDescription || "";
    let group = body.group || "";

    if (!asin || !productName || !productDescription || !group) {
      res.json({message: "The input you provided is not valid"});
      return;
    }

    let query = "update product set productName = '" + productName + "', productDescription = '" +
      productDescription + "', productGroup = '" + group + "' where asin = '" + asin + "';";

    conn.query(query, (err) => {
      if (err) {
        myLogger(err, 0);
        res.json({message: "The input you provided is not valid"});
        return;
      }
      myLogger('product name: ' + productName, 1);
      res.json({message: productName + " was successfully updated"});
    });
  };

  let viewUsers = (req, res) => {
    let fname = req.body.fname || "";
    let lname = req.body.lname || "";

    let query = "select id, fname, lname from user where fname like '%" + fname + "%' and lname like '%" + lname + "%';";

    conn.query(query, (err, rows) => {
      if (err || !rows.length) {
        myLogger(err, 0);
        res.json({message: "There are no users that match that criteria"});
        return;
      }

      let users = [];
      for (let i = 0; i < rows.length; i++) {
        users.push({fname: rows[i].fname, lname: rows[i].lname, userId: rows[i].id});
      }
      myLogger('users: ' + users, 1);
      res.json({message: "The action was successful", user: users});
    });
  };

  let viewProducts = (req, res) => {
    let body = req.body;
    let asin = body.asin || "";
    let keyword = body.keyword || "";
    let group = body.group || "";

    let conditions = [];

    if (asin) {
      conditions.push("asin = '" + asin + "'");
    }
    if (keyword) {
      conditions.push("(productName like '%" + keyword + "%' or productDescription like '%" + keyword + "%')");
    }
    if (group) {
      conditions.push("productGroup = '" + group + "'");
    }

    let query = "select asin, productName from product";

    if (conditions.length > 0) {
      query += (" where " + conditions.join(" and "));
    }

    query += ";";

    conn.query(query, (err, rows) => {
      if (err || !rows.length) {
        myLogger(err, 0);
        res.json({message: "There are no products that match that criteria"});
        return;
      }
      let products = [];

      for (let i = 0; i < rows.length; i++) {
        products.push({asin: rows[i].asin, productName: rows[i].productName});
      }
      myLogger('products: ' + products, 1);
      res.json({product: products});
    });
  };

  let buyProducts = (req, res) => {
    let body = req.body;
    let products = body.products;

    let asins = [];

    for (let i = 0; i < products.length; i++) {
      let product = products[i];
      let asin = product.asin;
      if (asin) {
        asins.push(asin);
      }
    }

    if (!asins.length) {
      myLogger("buyProducts - no valid asin in request.", 0);
      res.json({message: "There are no products that match that criteria"});
      return;
    }

    let query = "select asin from product where asin in (" + asins.join(",") + ");";
    let purchaseId = uuid();

    conn.query(query, (err, rows) => {
      if (err) {
        myLogger("buyProducts - sql error.\n" + err, 0);
        res.json({message: "There are no products that match that criteria"});
        return;
      }
      if (!rows.length) {
        myLogger("buyProducts - no matching asin found.", 0);
        res.json({message: "There are no products that match that criteria"});
        return;
      }
      let username = req.session.username;
      let purchases = [];
      for (let i = 0; i < rows.length; i++) {
        purchases.push("('" + purchaseId + "', '" + username + "', '" + rows[i].asin + "')");
      }

      let insertQuery = "insert into purchase values " + purchases.join(", ") + ";";

      conn.query(insertQuery, (err) => {
        if (err) {
          myLogger("buyProducts - create purchases failed.", 0);
          res.json({message: "There are no products that match that criteria"});
          return;
        }
        myLogger('purchase product', 1);
        res.json({message: "The action was successful"});
      });
    });
  };

  let productsPurchased = (req, res) => {
    let body = req.body;
    let username = body.username;

    let query = "select P.productName as name, count(O.asin) as quantity " +
      "from product as P, purchase as O where O.username = '" + username + "' and O.asin = P.asin " +
      "group by P.productName;";

    conn.query(query, (err, rows) => {
      if (err) {
        myLogger("productsPurchased - sql error.\n" + err, 0);
        res.json({message: "There are no users that match that criteria"});
        return;
      }
      let length = rows.length;
      if (!length || (length === 1 && rows[0].quantity === 0)) {
        myLogger("productsPurchased - no matching asin found.", 0);
        res.json({message: "There are no users that match that criteria"});
        return;
      }

      let products = [];
      for (let i = 0; i < length; i++) {
        products.push({productName: rows[i].name, quantity: rows[i].quantity});
      }
      myLogger('productsPurchased', 1);
      res.json({message: "The action was successful", products: products});
    });
  };

  let getRecommendations = (req, res) => {
    let body = req.body;
    let asin = body.asin || "";
    if (!asin) {
      myLogger("getRecommendations - no recommendations.", 0);
      res.json({message: "There are no recommendations for that product"});
      return;
    }

    let query = 'select asin from purchase where purchaseId in (select purchaseId from purchase where asin=' + asin
      + ') group by asin purchase by count(asin) desc LIMIT 5';

    conn.query(query, (err, rows) => {
      if (err) {
        myLogger("getRecommendations - sql error.\n" + err, 0);
        res.json({message: "There are no recommendations for that product"});
        return;
      }
      if (!rows.length) {
        myLogger("getRecommendations - no matching asin found", 0);
        res.json({message: "There are no recommendations for that product"});
        return;
      }

      let products = [];
      for (let i = 0; i < rows.length; i++) {
        products.push({asin: rows[i].asin});
      }
      myLogger('get recommendations', 1);
      res.json({message: "The action was successful", products: products});
    });
  };

  let myLogger = (msg, type) => {
    switch (type) {
      case 0: // failure
        console.log('failure');
        break;
      case 1: // success
        console.log('success');
    }
    console.log(msg);
  };
}

module.exports = Rest;