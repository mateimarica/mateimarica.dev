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

// Get all answers for a question
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
			`SELECT a.*, CONVERT(COALESCE(SUM(v1.vote), 0), SIGNED) AS votes, v2.vote AS currentUserVote ` +
			`FROM answers AS a ` +
			`LEFT OUTER JOIN votes AS v1 ON v1.answerId=a.id ` +
			`LEFT OUTER JOIN votes AS v2 ON v2.answerId=a.id AND v2.voter=? ` +
			`WHERE a.questionId=? ` +
			`GROUP BY a.id ` + 
			`ORDER BY CONVERT(COALESCE(SUM(v1.vote), 0), SIGNED) DESC LIMIT 15;`;

		let params = [req.body.session.username, questionId];

		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			res.status(200).json(results);
		});
	}, res, false, process.env.QR_DB_NAME);
});

router.patch('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let answer = req.body.params.answer,
	    id = req.body.params.id;

	if (!answer || answer.length < 1 || answer.length > 3500 || !id) 
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	
	users.isAuthor(req.body.session.username, id, users.postType.ANSWER, res, () => {
		connectionWrapper((connection) => {
			let sql = `UPDATE answers SET answer=? WHERE id=?;`;
			let params = [answer, id];

			connection.execute(sql, params, (err, results) => {
				if (err) {
					console.log(err);
					return res.sendStatus(500);
				}

				res.sendStatus(204);
			});
		}, res, false, process.env.QR_DB_NAME);
	});
});

router.delete('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let id = req.body.params.id;

	if (!id)
		return res.status(400).send('Missing argument');
	
	users.isAuthor(req.body.session.username, id, users.postType.ANSWER, res, () => {
		connectionWrapper((connection) => {
			let sql = `DELETE FROM answers WHERE id=?;`;
			let params = [id];

			connection.execute(sql, params, (err, results) => {
				if (err) {
					console.log(err);
					return res.sendStatus(500);
				}

				res.sendStatus(204);
			});
		}, res, false, process.env.QR_DB_NAME);
	});
});

module.exports = router;