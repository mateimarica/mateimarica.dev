const express = require('express'),
      router = express.Router(),
      rateLimit = require("express-rate-limit"),
      poolManager = require('pool-manager'),
      users = require('./users');

const pool = poolManager.getPool(process.env.QR_DB_NAME);

const POST_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_MSGS_POST_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.post('/', POST_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let recipient = req.body.params.recipient,
		message = req.body.params.message;

	if (!recipient || !message || message.length > 3500)
		return res.status(400).send('Missing or out-of-bounds argument(s)');

	let sql = `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?);`;
	let params = [req.body.session.username, recipient, message];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			switch (err.code) {
				case 'ER_NO_REFERENCED_ROW_2':
					return res.sendStatus(404);
			}
			console.log(err);
			return res.sendStatus(500);
		}

		res.sendStatus(201);
	});
});

const GET_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_MSGS_GET_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.get('/', GET_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let recipient = req.body.params.recipient;

	if (!recipient)
		return res.status(400).send('Missing argument(s)');
	
	let sql = 
		`SELECT * FROM messages ` +
		`WHERE ((recipient=? AND sender=?) OR (recipient=? AND sender=?)) ` +
		`ORDER BY dateCreated ASC;`;
	let params = [req.body.session.username, recipient, recipient, req.body.session.username];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		res.status(200).json(results);
	});
});

module.exports = router;