const express = require('express'),
      router = express.Router(),
      connectionWrapper = require('../../../../helpers/connectionWrapper'),
      users = require('./users');

router.post('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let title = req.body.params.title,
	    description = req.body.params.description,
	    tag = req.body.params.tag;

	if (!title || title.length < 6 || title.length > 200
	 || !description || description.length > 3500 
	 || !tag) {
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	}
	
	connectionWrapper((connection) => {
		let sql = `INSERT INTO questions (title, description, author, tag) VALUES (?, ?, ?, ?);`;
		let params = [title, description, req.body.session.username, tag];
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
	if (!req.body || !req.body.params || !req.body.params.id)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	connectionWrapper((connection) => {
		let sql = 
			`SELECT q.*, CONVERT(COALESCE(SUM(v1.vote), 0), SIGNED) AS votes, v2.vote AS currentUserVote, COALESCE(COUNT(a.id), 0) AS answerCount ` +
			`FROM questions AS q ` +
			`LEFT OUTER JOIN votes AS v1 ON v1.questionId=q.id ` +
			`LEFT OUTER JOIN votes AS v2 ON v2.questionId=q.id AND v2.voter=? ` +
			`LEFT OUTER JOIN answers AS a ON a.questionId=q.id ` +
			`WHERE q.id=? GROUP BY q.id LIMIT 1;`;

		let params = [req.body.session.username, req.body.params.id];

		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			if (results.length === 0 )
				return res.sendStatus(404);

			res.status(200).json(results[0]);
		});
	}, res, false, process.env.QR_DB_NAME);
});

router.get('/list', (req, res) => {
	if (!req.body)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	connectionWrapper((connection) => {
		let sql = 
			`SELECT q.*, CONVERT(COALESCE(SUM(v1.vote), 0), SIGNED) AS votes, v2.vote AS currentUserVote, COALESCE(COUNT(a.id), 0) AS answerCount ` +
			`FROM questions AS q ` +
			`LEFT OUTER JOIN votes AS v1 ON v1.questionId=q.id ` +
			`LEFT OUTER JOIN votes AS v2 ON v2.questionId=q.id AND v2.voter=? ` +
			`LEFT OUTER JOIN answers AS a ON a.questionId=q.id ` +
			`GROUP BY q.id LIMIT 15;`;

		let params = [req.body.session.username];
		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			res.status(200).json(results);
		});
	}, res, false, process.env.QR_DB_NAME);
});

const hasSolvedAnsOption = {
	EITHER: 'searchQuestionsHasAnswerEither',
	YES: 'yes',
	NO: 'no'
}

function addTag(tagName, params) {
	if (tagName) {
		params.push(tagName);
		return ' AND tag=?';
	}
	return '';
};

function addHasSolvedAnsConstraint(hasSolvedAnswer) {
	if (hasSolvedAnswer) {
		let sql = 'AND solvedAnswerId IS';
		switch (hasSolvedAnswer) {
			case hasSolvedAnsOption.YES:
				sql += ' NOT';
				break;
			case hasSolvedAnsOption.NO:
				break;
			default:
				return '';
		}
		sql += ' NULL';
		return sql;
	}
	return '';
};

router.get('/search', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let keywords = req.body.params.keywords,
	    tagName = req.body.params.tagName,
	    hasSolvedAnswer = req.body.params.hasSolvedAnswer;

	if (!keywords && !tagName && !hasSolvedAnswer)
		return res.status(400).send('Missing argument(s)');

	connectionWrapper((connection) => {
		keywords = '%' + keywords + '%';
		let params = [keywords, keywords];

		let sql =
			`SELECT q.*, CONVERT(COALESCE(SUM(v1.vote), 0), SIGNED) AS votes, v2.vote AS currentUserVote, COALESCE(COUNT(a.id), 0) AS answerCount ` +
			`FROM questions AS q ` +
			`LEFT OUTER JOIN votes AS v1 ON v1.questionId=q.id ` +
			`LEFT OUTER JOIN votes AS v2 ON v2.questionId=q.id AND v2.voter=? ` +
			`LEFT OUTER JOIN answers AS a ON a.questionId=q.id ` +
			`WHERE (title LIKE ? OR description LIKE ?)` + 
			`${addTag(tagName, params)} ${addHasSolvedAnsConstraint(hasSolvedAnswer)} ` +
			`GROUP BY q.id ORDER BY title DESC LIMIT 1;`;

		params.unshift(req.body.session.username); // Add username to the beginning after params edited

		connection.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			res.status(200).json(results);
		});
	}, res, false, process.env.QR_DB_NAME);
});

router.patch('/toggle-pin', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);
	
	let id = req.body.params.id;

	if (!id)
		return res.status(400).send('Missing argument(s)');

	users.isAdmin(req.body.session.username, res, () => {
		connectionWrapper((connection) => {
			let sql = `UPDATE questions SET isPinned = isPinned * -1 WHERE id = ?;`;
			let params = [id];
	
			connection.execute(sql, params, (err, results) => {
				if (err) {
					console.log(err);
					return res.sendStatus(500);
				}
	
				if (results && results.changedRows === 1)
					res.sendStatus(204);
				else
					res.sendStatus(404);
			});
		}, res, false, process.env.QR_DB_NAME);
	});
});

router.patch('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let id = req.body.params.id,
	    description = req.body.params.description,
	    tag = req.body.params.tag;

	if (!id || (!description && !tag))
		return res.status(400).send('Missing argument(s)');

	users.isAuthor(req.body.session.username, id, users.postType.QUESTION, res, () => {
		connectionWrapper((connection) => {
			let sql = `UPDATE questions SET`;
			let params = [id];

			if (description) {
				sql += ` description=? `;
				if (tag) {
					sql += `,  tag=? `;
					params.unshift(description, tag);
				} else {
					params.unshift(description);
				}
			} else { // tag must be present
				sql += ` tag=?`;
				params.unshift(tag);
			}

			sql += ` WHERE id=?;`
			
			connection.execute(sql, params, (err, results) => {
				if (err) {
					console.log(err);
					return res.sendStatus(500);
				}
	
				if (results && results.changedRows === 1)
					res.sendStatus(204);
				else
					res.sendStatus(404);
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
		return res.status(400).send('Missing argument(s)');

	users.isAuthor(req.body.session.username, id, users.postType.QUESTION, res, () => {
		connectionWrapper((connection) => {
			let sql = `DELETE FROM questions WHERE id=?;`;
			let params = [id];

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
});

router.patch('/solve', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let id = req.body.params.id,
	    solvedAnswerId = req.body.params.solvedAnswerId;
	
	if (!id || !solvedAnswerId || solvedAnswerId.length !== 36)
		return res.status(400).send('Missing argument(s)');

	users.isAuthor(req.body.session.username, id, users.postType.QUESTION, res, () => {
		connectionWrapper((connection) => {
			let sql = `UPDATE questions SET solvedAnswerId=? WHERE id=?;`;
			let params = [solvedAnswerId, id];

			connection.execute(sql, params, (err, results) => {
				if (err) {
					if(err.code === 'ER_NO_REFERENCED_ROW_2') // Foreign key constraint fails - there's no answer with that id
						return res.sendStatus(404);
					
					console.log(err);
					return res.sendStatus(500);
				}
	
				if (results && results.changedRows === 1)
					res.sendStatus(204);
				else
					res.sendStatus(404);
			});
		}, res, false, process.env.QR_DB_NAME);
	});
});

module.exports = router;