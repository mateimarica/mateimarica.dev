const express = require('express'),
      router = express.Router(),
      connectionWrapper = require('../../../../helpers/connectionWrapper'),
      users = require('./users');

router.post('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let vote = req.body.params.vote,
	    questionId = req.body.params.questionId
	    answerId = req.body.params.answerId;

	// vote must be int, vote must be between -1 and 1, must have questionId or answerId (but not both),
	// and the question/answer id length must be 36
	if (!Number.isInteger(vote) || vote < -1 || vote > 1 || (questionId ? answerId : !answerId) // XOR
	 || !((questionId && questionId.length === 36) || (answerId && answerId.length === 36))) {
		return res.status(400).send('Missing, invalid, out-of-bounds, or too many argument(s)');
	}

	connectionWrapper((connection) => {
		let sql, params;
		if (questionId) {
			sql = `INSERT INTO votes (vote, questionId, voter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote=?;`;
			params = [vote, questionId, req.body.session.username];
		} else {
			sql = `INSERT INTO votes (vote, answerId, voter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote=?;`;
			params = [vote, answerId, req.body.session.username, vote];
		}
		
		connection.execute(sql, params, (err, results) => {
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
	}, res, false, process.env.QR_DB_NAME);
});

router.delete('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let questionId = req.body.params.questionId
	    answerId = req.body.params.answerId;

	if ((questionId ? answerId : !answerId) // XOR
	 || !((questionId && questionId.length === 36) || (answerId && answerId.length === 36))) {
		return res.status(400).send('Missing, invalid, out-of-bounds, or too many argument(s)');
	}
	
	connectionWrapper((connection) => {
		let sql = `DELETE FROM votes WHERE id=?;`,
		    params;
		
		if (questionId) 
			params = [questionId + req.body.session.username];
		else 
			params = [answerId + req.body.session.username];

		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			if (results && results.affectedRows === 1)
				res.sendStatus(204);
			else
				res.sendStatus(404);
		});
	}, res, false, process.env.QR_DB_NAME);
});

module.exports = router;