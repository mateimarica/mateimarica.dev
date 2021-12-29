require('dotenv').config();
const express = require('express'),
      path = require('path'),
      http = require('http'),
      https = require('https'),
      fs = require('fs'),
      rateLimit = require("express-rate-limit"),
      helmet = require("helmet"),
      morganLogger = require('morgan'),
      reqSniffer = require('app/middleware/requestSniffer'),
      invalidJsonHandler = require('app/middleware/invalidJsonHandler'),
      qrequest = require('./subdomains/qr/qr'),
      subdomain = require('express-subdomain');

reqSniffer.initializeIpCache();

let credentials;
if (process.env.NODE_ENV === 'production') {
	credentials = {
		key: fs.readFileSync(process.env.SSL_PRIVATE_KEY),
		cert: fs.readFileSync(process.env.SSL_CERT)
	}
}

const STATIC_PAGE_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.STATIC_LIMITER_MAX_REQUESTS * process.env.NUM_OF_STATIC_FILES, // Max num of requests per time window * the rough num of static files
	message: "Too many requests, try again later.",
	headers: false,
	onLimitReached: (req) => reqSniffer.recordSuspiciousIP(req, 429, process.env.STATIC_LIMITER_MAX_REQUESTS * process.env.NUM_OF_STATIC_FILES)
});

const API_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.API_LIMITER_MAX_REQUESTS,
	message: "Too many requests, try again later.",
	headers: false
});

const app = express();
app.use(helmet());
app.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
app.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));
let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
app.use(morganLogger('common', { stream: accessLogStream }));
app.use(reqSniffer.requestSniffer);
app.use(invalidJsonHandler);
app.use(subdomain('qr', qrequest));

app.use('/resume', API_RATE_LIMITER, require('./routes/resume'));
app.use('/api/complaints', API_RATE_LIMITER, require('./routes/api/complaints'));
app.use(['/about', '/contact'], API_RATE_LIMITER, require('./routes/WIP'));
app.use('/', STATIC_PAGE_RATE_LIMITER); // Limit static page requests
app.use(express.static(path.join(__dirname, '../frontend/main')));
app.get('*', (req, res) => { // Send 404 page for any other page
	res.status(404).sendFile(path.join(__dirname, 'components/404.html'));
	reqSniffer.recordSuspiciousIP(req);
});
app.use('*', (req, res) => {
	res.sendStatus(404);
	reqSniffer.recordSuspiciousIP(req);
});

let server;
if (process.env.NODE_ENV === 'production') {
	server = https.createServer(credentials, app);
} else {
	server = http.createServer(app);
}

server.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));