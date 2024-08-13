'use strict';

require('dotenv').config();
const express = require('express'),
      path = require('path'),
      https = require('https'),
      fs = require('fs'),
      rateLimit = require("express-rate-limit"),
      helmet = require("helmet"),
      morganLogger = require('morgan'),
      // reqSniffer = require('request-sniffer'),
      invalidJsonHandler = require('invalid-json-handler'),
      qrequest = require('./subdomains/qr/qr'),
      files = require('./subdomains/files/files'),
      searchicton = require('./subdomains/searchicton/searchicton'),
      jquestrade = require('./subdomains/jquestrade/jquestrade'),
      subdomain = require('express-subdomain'),
      compression = require('compression'),
      url = require('url'),
      mailWrapper = require('mail-wrapper');

//reqSniffer.initializeIpCache();
mailWrapper.checkConnection();

const STATIC_PAGE_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.STATIC_LIMITER_MAX_REQUESTS * process.env.NUM_OF_STATIC_FILES, // Max num of requests per time window * the rough num of static files
	message: "Too many requests, try again later.",
	headers: false,
	// onLimitReached: (req) => reqSniffer.recordSuspiciousIP(req, 429, process.env.STATIC_LIMITER_MAX_REQUESTS * process.env.NUM_OF_STATIC_FILES)
});

const API_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.API_LIMITER_MAX_REQUESTS,
	message: "Too many requests, try again later.",
	headers: false
});

const DOMAIN_SRC = "mateimarica.dev",
      SUBDOMAIN_SRC = "*.mateimarica.dev",
      SELF_SRC = "'self'",
	  NONE_SRC = "'none'";

const app = express();
const helmetFunc = helmet({
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			"default-src": [NONE_SRC],
			"base-uri": [NONE_SRC],
			"upgrade-insecure-requests": [],
			"img-src": [SELF_SRC, DOMAIN_SRC],
			"script-src": [SELF_SRC, SUBDOMAIN_SRC],
			"manifest-src": [SELF_SRC],
			"style-src": [SELF_SRC, DOMAIN_SRC, SUBDOMAIN_SRC, "'unsafe-inline'"],
			"connect-src": [SELF_SRC], // specifies which URLs can be loaded using APIs like XMLHttpRequest,
			"media-src": [SELF_SRC], // allow stuff like mp3s and mp4s to be loaded in the browser
			"frame-ancestors": [NONE_SRC]
		}
	},
	// these headers are redundant or deprecated on modern browsers
	xssFilter: false,
	ieNoOpen: false,
	dnsPrefetchControl: false,
	expectCt: false,
	frameguard: ''
});

// Allow getting scripts from files domain
app.use(function (req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// Add CSP header only if user requests HTML. This reduces data use by ~25%.
// Is this secure? Probably not, but I can't latch on to the response for static pages to target the Content-Type header
app.use((req, res, next) => {
	const accept = req.get('accept');
	if (accept && accept.indexOf('text/html') === 0) {
		helmetFunc(req, res, next);
	} else {
		next();
	}
});

app.use(compression());
app.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
app.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));
let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
app.use(morganLogger('common', { stream: accessLogStream }));
// app.use(reqSniffer.requestSniffer);
app.use(invalidJsonHandler);
app.use(subdomain('files', files.router));
app.use(subdomain('f', (req, res, next) => {
	res.redirect('https://files.mateimarica.dev' + req.url); // keep query params
}));
app.use(subdomain('qr', qrequest));
app.use(subdomain('searchicton', searchicton));
app.use(subdomain('jquestrade', jquestrade));
app.use(STATIC_PAGE_RATE_LIMITER); // Limit static page requests

app.use('/resume', require('./routes/resume'));
app.use('/activerecord_vs_rawsql_article', require('./routes/article'));
app.use('/api/complaints', API_RATE_LIMITER, require('./routes/api/complaints'));
app.use(['/about', '/contact'], API_RATE_LIMITER, require('./routes/WIP'));

app.get('/index.html', STATIC_PAGE_RATE_LIMITER, (req, res) => {
	res.redirect('/');
});

// Allow any domain to access the icons
app.get('/icons/*', (req, res, next) => {
	res.set('Access-Control-Allow-Origin', '*');
	next();
});

app.use(express.static(path.join(__dirname, 'frontend_build/main')));

app.use(require('not-found'));

const OPTIONS = {
	key: fs.readFileSync(process.env.SSL_PRIVATE_KEY),
	cert: fs.readFileSync(process.env.SSL_CERT),
	requestTimeout: process.env.REQUEST_TIMEOUT_MINS * 60 * 1000,
	connectionsCheckingInterval: process.env.CONNECTIONS_CHECKING_INTERVAL_MINS * 60 * 1000,
}

const SERVER = https.createServer(OPTIONS, app);
SERVER.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));