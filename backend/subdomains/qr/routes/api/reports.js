const express = require('express'),
      router = express.Router(),
      connectionWrapper = require('../../../../helpers/connectionWrapper'),
      users = require('./users');

router.post('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let type = req.body.params.type,
	    description = req.body.params.description,
	    questionId = req.body.params.questionId,
	    answerId = req.body.params.answerId;

	if (!type || type.length > 200
		|| !description || description.length > 3500 
		|| (questionId ? answerId : !answerId) // XOR
		|| !((questionId && questionId.length === 36) || (answerId && answerId.length === 36))) { 
		return res.status(400).send('Missing, out-of-bounds, or too many argument(s)');
	}
	
	connectionWrapper((connection) => {
		let sql, params;
		if (questionId) {
			sql = `INSERT INTO reports (type, description, questionId, reporter) VALUES (?, ?, ?, ?);`;
			params = [type, description, questionId, req.body.session.username];
		} else {
			sql = `INSERT INTO reports (type, description, answerId, reporter) VALUES (?, ?, ?, ?);`;
			params = [type, description, answerId, req.body.session.username];
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

module.exports = router;