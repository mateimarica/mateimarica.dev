require('dotenv').config();
const express = require('express'),
      path = require('path'),
      logger = require('./middleware/logger');
      http = require('http'),
      https = require('https'),
      fs = require('fs'),
      rateLimit = require("express-rate-limit");
      
let credentials;
if (process.env.NODE_ENV === 'prod') {
    CREDENTIALS = {
        key: fs.readFileSync(process.env.SSL_PRIVATE_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
    }
}

const STATIC_PAGE_RATE_LIMITER = rateLimit({ // this rate limiter applies to all requests
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.MAX_REQUESTS_FOR_STATIC_SITE * process.env.NUMBER_OF_STATIC_FILES, // Max num of requests per time window times the number of static files, since each file is 1 request
    message: "Too many requests, please try again later.<br>I hope you're not trying to do anything malicious."
});

const API_RATE_LIMITER = rateLimit({ // this rate limiter applies to all requests
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.MAX_REQUESTS_FOR_API,
    message: "Too many API requests, please try again later."
});

const app = express();

app.use(logger);
app.use('/api/complaints', API_RATE_LIMITER, require('./routes/api/complaints')); // Use logger middleware function to print logs during runtime
app.use('/', STATIC_PAGE_RATE_LIMITER); // Limit static page requests
app.use(express.static(path.join(__dirname, '../frontend'))); // Set static folder
app.get('*', (req, res) => { // Send 404 page for any other page
    res.status(404).sendFile(path.join(__dirname, '../frontend/components/404.html'));
});

let server;
if (process.env.NODE_ENV === 'prod') {
    server = https.createServer(CREDENTIALS, app);
} else {
    server = http.createServer(app);
}


server.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));