const express = require('express'),
      router = express.Router(),
      connectionWrapper = require('../../../../helpers/connectionWrapper'),
	  users = require('./users');

router.post('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let answer = req.body.params.answer,
	    questionId = req.body.params.questionId;

	if (!answer || answer.length < 1 || answer.length > 3500 
	 || !questionId || questionId.length !== 36) {
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	}

	connectionWrapper((connection) => {
		let sql = `INSERT INTO answers (answer, questionId, author) VALUES (?, ?, ?);`;
		let params = [answer, questionId, req.body.session.username];
		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			res.sendStatus(201);
		});
	}, res, false, process.env.QR_DB_NAME);
});

router.get('/', (req, res) => {
	if (!req.body)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);
	
	let questionId = req.body.params.questionId;

	if (!questionId)
		return res.status(400).send('Missing argument(s)');

	connectionWrapper((connection) => {
		let sql = 
			`SELECT * FROM answers WHERE questionId=? ` + 
			`ORDER BY IFNULL((SELECT SUM(vote) FROM votes WHERE post_id = answers.id), 0) DESC,` + `date_created DESC LIMIT 20;`;

		let params = [questionId];
		
		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			res.status(200).json(results);
		});

	}, res, false, process.env.QR_DB_NAME);
});

module.exports = router;