const express = require('express'),
      router = express.Router(),
	  crypto = require('crypto'),
	  connectionWrapper = require('../../../../helpers/connectionWrapper');

let activeSessions = [];

router.post('/register', (req, res) => {
	if (!req.body || !req.body.username || !req.body.password 
	 || req.body.username.length < 3 || req.body.username.length > 10
	 || req.body.password.length < 3 || req.body.password.length > 40) {
		return res.sendStatus(400);
	}

	connectionWrapper((connection) => {
		let sql = `INSERT INTO users (username, password) VALUES (?, SHA1(?));`;
		let params = [req.body.username, req.body.password];

		connection.execute(sql, params, (err, results) => {
			if (err) {
				if (err.code === 'ER_DUP_ENTRY') {
					return res.sendStatus(409);
				}
				console.log(err);
				return res.sendStatus(500);
			}

			res.statusCode = 201;
			login(req.body.username, res);
		});
	}, res, false, process.env.QR_DB_NAME);
});

function login(username, res) {
	let newActiveSession = {
		username: username,
		sessionID: crypto.randomBytes(16).toString('base64'),
		lastActive: new Date()
	}

	activeSessions.push(newActiveSession);

	res.json({sessionID: newActiveSession.sessionID});
}

router.get('/login', (req, res) => {
	if (!req.body || !req.body.username || !req.body.password 
	 || req.body.username.length < 3 || req.body.username.length > 10
	 || req.body.password.length < 3 || req.body.password.length > 40) {
		return res.sendStatus(400);
	}

	connectionWrapper((connection) => {
		let sql = `SELECT COUNT(1) FROM users WHERE username=? AND password=SHA1(?);`;
		let params = [req.body.username, req.body.password];

		connection.execute({sql: sql, rowsAsArray: true}, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			if (results[0][0] === 0) {
				return res.sendStatus(404);
			}
			
			res.statusCode = 200;
			login(req.body.username, res);
		});
	}, res, false, process.env.QR_DB_NAME);
});

router.get('/search', (req, res) => {
	if (!req.body || !req.body.params || !req.body.params.username) {
		return res.sendStatus(400);
	}

	if (!isSessionValid(req.body.session)) {
		return res.sendStatus(401);
	}

	connectionWrapper((connection) => {
		let sql = `SELECT * FROM users WHERE username LIKE ?;`;
		let params = [req.body.usernameSearch + '%'];

		connection.execute({sql: sql, rowsAsArray: true}, params, (err, results) => {
			if (err) {
				console.log(err.code);
				return res.sendStatus(500);
			}

			if (results[0][0] === 0) {
				return res.sendStatus(404);
			}
			
			res.statusCode = 200;
			login(req.body.username, res);
		});
	}, res, false, process.env.QR_DB_NAME);
});

const MILLI_PER_HOUR = 3600000;
function isSessionValid(session) {
	if (!session || !session.username || !session.sessionID) return false

	for (let i = 0; i < activeSessions.length; i++) {
		if (session.sessionID === activeSessions[i].sessionID && session.username === activeSessions[i].username) {
			let currentDate = new Date();
			if ((currentDate - activeSessions[i].lastActive) < MILLI_PER_HOUR) {
				activeSessions[i].lastActive = currentDate;
				return true;
			} else {
				activeSessions.splice(i, 1); // removes 1 element starting at index i
				i--; // so it doesn't skip the next index
			}
		}
	}

	return false;
}

module.exports = { router, isSessionValid };