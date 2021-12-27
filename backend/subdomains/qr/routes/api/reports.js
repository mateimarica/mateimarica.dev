const express = require('express'),
      router = express.Router(),
      rateLimit = require("express-rate-limit"),
      poolManager = require('app/helpers/poolManager'),
      users = require('./users');

const pool = poolManager.getPool(process.env.QR_DB_NAME);

const REPORTS_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_REPORTS_POST_LIMITER_MAX_REQUESTS,
	message: "You're complaing too much. Try again later.",
	headers: false
});

router.post('/', REPORTS_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let type = req.body.params.type,
	    description = req.body.params.description,
	    questionId = req.body.params.questionId,
	    answerId = req.body.params.answerId;

	if (!type || type.length > 200
		|| (!description && description !== '') || description.length > 3500 
		|| (questionId ? answerId : !answerId) // XOR
		|| !((questionId && questionId.length === 36) || (answerId && answerId.length === 36))) { 
		return res.status(400).send('Missing, out-of-bounds, or too many argument(s)');
	}
	
	let sql, params;
	if (questionId) {
		sql = `INSERT INTO reports (type, description, questionId, reporter) VALUES (?, ?, ?, ?);`;
		params = [type, description, questionId, req.body.session.username];
	} else {
		sql = `INSERT INTO reports (type, description, answerId, reporter) VALUES (?, ?, ?, ?);`;
		params = [type, description, answerId, req.body.session.username];
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

module.exports = router;