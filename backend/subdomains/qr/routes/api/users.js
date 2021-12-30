const express = require('express'),
      router = express.Router(),
      crypto = require('crypto'),
      rateLimit = require("express-rate-limit"),
      poolManager = require('app/helpers/poolManager');

let activeSessions = [];
const pool = poolManager.getPool(process.env.QR_DB_NAME);

const REGISTER_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_USERS_REGISTER_LIMITER_MAX_REQUESTS,
	message: "You already made an account recently. Wait a few minutes.",
	headers: false
});

router.post('/register', REGISTER_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params) 
		return res.sendStatus(400);
	
	let username = req.body.params.username,
	    password = req.body.params.password;

	if (!username || username.length < 3 || username.length > 10
	 || !password || password.length < 3 || password.length > 40) {
		return res.status(400).send("Missing or out-of-bounds arguments");
	}

	let sql = `INSERT INTO users (username, password) VALUES (?, SHA1(?));`;
	let params = [username, password];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			if (err.code === 'ER_DUP_ENTRY') {
				return res.sendStatus(409);
			}
			console.log(err);
			return res.sendStatus(500);
		}

		res.statusCode = 201;
		login(username, false, res);
	});
});

function login(username, isAdmin, res) {
	let newActiveSession = {
		username: username,
		lastActive: new Date(),
		sessionId: crypto.randomBytes(16).toString('base64')
	}

	activeSessions.push(newActiveSession);

	res.json({
		session: {
			username: username,
			isAdmin: isAdmin,
			sessionId: newActiveSession.sessionId
		}
	});
}

const LOGIN_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_USERS_LOGIN_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.post('/login', LOGIN_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params) 
		return res.sendStatus(400);
	
	let username = req.body.params.username,
	    password = req.body.params.password;

	if (!username || username.length < 3 || username.length > 10
	 || !password || password.length < 3 || password.length > 40) {
		return res.status(400).send("Missing or out-of-bounds arguments");
	}

	let sql = `SELECT isAdmin FROM users WHERE username=? AND password=SHA1(?);`;
	let params = [username, password];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		if (results && results.length === 1) {
			res.statusCode = 200;
			login(username, !!results[0].isAdmin, res);
			removeOldSessions(username);
		} else {
			res.sendStatus(404);
		}
	});
});

const SEARCH_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_USERS_SEARCH_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

// search for multiple
router.get('/search', SEARCH_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!isSessionValid(req.body.session, res)) return;

	let username = req.body.params.username,
	    maxResultCount = req.body.params.maxResultCount;

	if (!username || !Number.isInteger(maxResultCount) || maxResultCount < 1 || maxResultCount > 15)
		return res.status(400).send("Missing or out-of-bounds arguments");

	let sql = `SELECT username FROM users WHERE username LIKE ? LIMIT ${maxResultCount};`;
	let params = [req.body.params.username + '%'];
	pool.execute({sql: sql, rowsAsArray: true}, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}
		
		res.status(200).json(results.flat());
	});
});

const MILLI_PER_HOUR = 3600000;
function isSessionValid(session, res) {
	if (!session || !session.username || !session.sessionId) return false

	for (let i = 0; i < activeSessions.length; i++) {
		if (session.sessionId === activeSessions[i].sessionId && session.username === activeSessions[i].username) {
			let currentDate = new Date();
			if ((currentDate - activeSessions[i].lastActive) < MILLI_PER_HOUR) {
				activeSessions[i].lastActive = currentDate;
				return true;
			} else {
				activeSessions.splice(i, 1); // removes 1 element starting at index i
				res.set('WWW-Authenticate', 'Basic realm="qrequest"');
				res.sendStatus(401);
				return false;
			}
		}
	}

	res.set('WWW-Authenticate', 'Basic realm="qrequest"');
	res.sendStatus(401);
	return false;
}

function removeOldSessions(username) {
	let currentDate = new Date();
	for (let i = 0; i < activeSessions.length; i++) {
		if ((currentDate - activeSessions[i].lastActive) >= MILLI_PER_HOUR) {
			activeSessions.splice(i, 1); // removes 1 element starting at index i
			i--;
		}
	}
}

function isAdmin(username, res, callback) {
	if (!username || !res || !callback)
		return res.sendStatus(500);

	let sql = `SELECT isAdmin FROM users WHERE username=?;`
	let params = [username];
	pool.execute({sql: sql, rowsAsArray: true}, params, (err, results) => {
		if (err) {
			console.log(err);
			return;
		}
		if (results.flat()[0] === 1)
			callback();
		else 
			res.sendStatus(403);
	});
}

// The values correspond with the table names
const postType = {
	QUESTION: 'questions',
	ANSWER: 'answers'
}

function isAuthor(username, id, postType, res, callback) {
	if (!username || !id || !postType || !res || !callback)
		return res.sendStatus(500);

	let sql = `SELECT COUNT(*) FROM ${postType} WHERE id=? AND author=?;`
	let params = [id, username];
	pool.execute({sql: sql, rowsAsArray: true}, params, (err, results) => {
		if (err) {
			console.log(err);
			return;
		}
		
		if (results.flat()[0] === 1)
			callback();
		else 
			res.sendStatus(403);
	});
}

router.get('*', (req, res) => {
	res.sendStatus(404);
});

module.exports = { router, isSessionValid, isAdmin, isAuthor, postType };