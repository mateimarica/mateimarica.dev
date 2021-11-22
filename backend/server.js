require('dotenv').config();
const express = require('express'),
      path = require('path'),
      logger = require('./middleware/logger');
      http = require('http'),
      https = require('https'),
      fs = require('fs');
      
const app = express();

let credentials;
if (process.env.ENV === 'prod') {
    credentials = {
        key: fs.readFileSync(process.env.SSL_PRIVATE_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
    }
}

// Use logger middleware function to print logs during runtime
app.use(logger);

app.use('/api/complaints', require('./routes/api/complaints'));

// Set static folder
app.use(express.static(path.join(__dirname, '../', 'frontend')));

let server;
if (process.env.ENV === 'prod') {
    server = https.createServer(credentials, app);
} else {
    server = http.createServer(app);
}

server.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));