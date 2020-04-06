# Data Intensive Web Server

A backend server for an e-commerce system.
The purpose of this project was to develop a robust, fault-tolerant and scalable web server with high throughput and low latency.
It must serve approximately 2 million requests per minute and performe search queries over a million records.

The web service is served by a `NodeJS` server using `ExpressJS`. 

APIs include:
* Health check
* User registration
* User session management
* Create/Read/Update/Delete user information
* Create/Read/Update/Delete product information
* Buy products
* View purchased products for user
* View product recommendations for user

The server was deployed on `AWS EC2` with `MySQL` as database and `Redis` for caching.
