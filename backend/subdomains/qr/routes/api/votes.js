const express = require('express'),
      router = express.Router(),
      rateLimit = require("express-rate-limit"),
      poolManager = require('app/helpers/poolManager'),
      users = require('./users');

const pool = poolManager.getPool(process.env.QR_DB_NAME);

const POST_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_VOTES_POST_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.post('/', POST_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let vote = req.body.params.vote,
	    questionId = req.body.params.questionId
	    answerId = req.body.params.answerId;

	// vote must be int, vote must be between -1 and 1, must have questionId or answerId (but not both),
	// and the question/answer id length must be 36
	if (!Number.isInteger(vote) || vote < -1 || vote > 1 || (questionId ? answerId : !answerId) // XOR
	 || !((questionId && questionId.length === 36) || (answerId && answerId.length === 36))) {
		return res.status(400).send('Missing, invalid, out-of-bounds, or too many argument(s)');
	}

	let sql, params;
	if (questionId) {
		sql = `INSERT INTO votes (vote, questionId, voter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote=?;`;
		params = [vote, questionId, req.body.session.username, vote];
	} else {
		sql = `INSERT INTO votes (vote, answerId, voter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote=?;`;
		params = [vote, answerId, req.body.session.username, vote];
	}
	
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

const DELETE_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_VOTES_DELETE_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.delete('/', DELETE_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let questionId = req.body.params.questionId
	    answerId = req.body.params.answerId;

	if ((questionId ? answerId : !answerId) // XOR
	 || !((questionId && questionId.length === 36) || (answerId && answerId.length === 36))) {
		return res.status(400).send('Missing, invalid, out-of-bounds, or too many argument(s)');
	}
	
	let sql = `DELETE FROM votes WHERE id=?;`,
		params;
	
	if (questionId) 
		params = [questionId + req.body.session.username];
	else 
		params = [answerId + req.body.session.username];

		pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		if (results && results.affectedRows === 1)
			res.sendStatus(204);
		else
			res.sendStatus(404);
	});
});

module.exports = router;