require('dotenv').config();
const express = require('express'),
      path = require('path'),
      http = require('http'),
      https = require('https'),
      fs = require('fs'),
      rateLimit = require("express-rate-limit"),
      helmet = require("helmet"),
      morganLogger = require('morgan'),
      reqSniffer = require('request-sniffer'),
      invalidJsonHandler = require('invalid-json-handler'),
      qrequest = require('./subdomains/qr/qr'),
      files = require('./subdomains/files/files'),
      searchicton = require('./subdomains/searchicton/searchicton'),
      subdomain = require('express-subdomain'),
      compression = require('compression'),
      mailWrapper = require('mail-wrapper');

reqSniffer.initializeIpCache();
mailWrapper.checkConnection();

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

const DOMAIN_SRC = "mateimarica.dev",
      SUBDOMAIN_SRC = "*.mateimarica.dev"
      SELF_SRC = "'self'",
	  NONE_SRC = "'none'";

const app = express();
app.use(helmet({
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			"default-src": [NONE_SRC],
			"base-uri": [NONE_SRC],
			"upgrade-insecure-requests": [],
			"img-src": [SELF_SRC, DOMAIN_SRC],
			"script-src": [SELF_SRC],
			"style-src": [SELF_SRC, DOMAIN_SRC, "'unsafe-inline'"],
			"connect-src": [SELF_SRC] // specifies which URLs can be loaded using APIs like XMLHttpRequest
		}
	}
}));

app.use(compression());
app.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
app.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));
let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
app.use(morganLogger('common', { stream: accessLogStream }));
app.use(reqSniffer.requestSniffer);
app.use(invalidJsonHandler);
app.use(subdomain('files', files.router));
app.use(subdomain('qr', qrequest));
app.use(subdomain('searchicton', searchicton));

app.use('/resume', API_RATE_LIMITER, require('./routes/resume'));
app.use('/api/complaints', API_RATE_LIMITER, require('./routes/api/complaints'));
app.use(['/about', '/contact'], API_RATE_LIMITER, require('./routes/WIP'));

app.get('/index.html', STATIC_PAGE_RATE_LIMITER);

app.get('/index.html', STATIC_PAGE_RATE_LIMITER, (req, res) => {
	res.redirect('/');
});

app.use('/', STATIC_PAGE_RATE_LIMITER); // Limit static page requests
app.use(express.static(path.join(__dirname, 'frontend_build/main')));
app.get('*', (req, res) => { // Send 404 page for any other page
	res.status(404).sendFile(path.join(__dirname, 'frontend_build/main_components/404.html'));
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