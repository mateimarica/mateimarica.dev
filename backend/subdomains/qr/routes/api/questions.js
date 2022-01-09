const express = require('express'),
      router = express.Router(),
      rateLimit = require("express-rate-limit"),
      mysql = require('mysql2'),
      poolManager = require('pool-manager'),
      users = require('./users');

const pool = poolManager.getPool(process.env.QR_DB_NAME);

const POST_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_POST_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.post('/', POST_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let title = req.body.params.title,
	    description = (req.body.params.description ? req.body.params.description : ''),
	    tag = req.body.params.tag;

	if (!title || title.length < 6 || title.length > 200
	 || (description && description.length > 3500)
	 || !tag) {
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	}
	
	let sql = `INSERT INTO questions (title, description, author, tag) VALUES (?, ?, ?, ?);`;
	let params = [title, description, req.body.session.username, tag];
	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		res.sendStatus(201);
		
	});
});

const GET_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_GET_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.get('/', GET_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params || !req.body.params.id)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let sql = 
		`SELECT q.*, ` +
		`COALESCE((SELECT CONVERT(SUM(vote), SIGNED) FROM votes WHERE questionId=q.id), 0) AS votes, ` +
		`COALESCE((SELECT vote FROM votes WHERE questionId=q.id AND voter=?), 0) AS currentUserVote, ` +
		`COALESCE((SELECT COUNT(*) FROM answers WHERE questionId=q.id), 0) AS answerCount ` +
		`FROM questions AS q WHERE q.id=? LIMIT 1;`;

	let params = [req.body.session.username, req.body.params.id];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		if (results.length === 0 )
			return res.sendStatus(404);

		results[0].isPinned = !!results[0].isPinned;
		res.status(200).json(results[0]);
	});
});

const LIST_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_LIST_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.get('/list', LIST_RATE_LIMITER, (req, res) => {
	if (!req.body)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let sql = 
		`SELECT q.*, ` +
		`COALESCE((SELECT CONVERT(SUM(vote), SIGNED) FROM votes WHERE questionId=q.id), 0) AS votes, ` +
		`COALESCE((SELECT vote FROM votes WHERE questionId=q.id AND voter=?), 0) AS currentUserVote, ` +
		`COALESCE((SELECT COUNT(*) FROM answers WHERE questionId=q.id), 0) AS answerCount ` +
		`FROM questions AS q ` +
		`ORDER BY q.isPinned DESC, votes DESC LIMIT 35;`

	let params = [req.body.session.username];
	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		for(let i = 0; i < results.length; i++) {
			results[i].isPinned = !!results[i].isPinned;
		}
		res.status(200).json(results);
	});
});

const hasSolvedAnsOption = {
	EITHER: "EITHER",
	YES: "YES",
	NO: "NO"
}

function addTag(tagName, params) {
	if (tagName) {
		params.push(tagName);
		return 'tag=?';
	}
	return 'TRUE';
};

function addHasSolvedAnsConstraint(hasSolvedAnswer) {
	if (hasSolvedAnswer) {
		let sql = 'solvedAnswerId IS';
		switch (hasSolvedAnswer) {
			case hasSolvedAnsOption.YES:
				sql += ' NOT';
				break;
			case hasSolvedAnsOption.NO:
				break;
			default:
				return 'TRUE';
		}
		sql += ' NULL';
		return sql;
	}
	return 'TRUE';
};

function addKeywords(keywords, params) {
	if(keywords) {
		keywords = '%' + keywords + '%';
		params.unshift(keywords, keywords);
		return `(title LIKE ? OR description LIKE ?)`;
	}
	return 'TRUE';
}

const SEARCH_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_SEARCH_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.get('/search', SEARCH_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let keywords = req.body.params.keywords,
	    tag = req.body.params.tag,
	    hasSolvedAnswer = req.body.params.hasSolvedAnswer;

	if (!keywords && !tag && !hasSolvedAnswer)
		return res.status(400).send('Missing argument(s)');

	let params = [];
	let sql =
		`SELECT q.*, ` +
		`COALESCE((SELECT CONVERT(SUM(vote), SIGNED) FROM votes WHERE questionId=q.id), 0) AS votes, ` +
		`COALESCE((SELECT vote FROM votes WHERE questionId=q.id AND voter=?), 0) AS currentUserVote, ` +
		`COALESCE((SELECT COUNT(*) FROM answers WHERE questionId=q.id), 0) AS answerCount ` +
		`FROM questions AS q WHERE ` +
		`${addKeywords(keywords, params)} AND ${addTag(tag, params)} AND ${addHasSolvedAnsConstraint(hasSolvedAnswer)} ` +
		`ORDER BY q.isPinned DESC LIMIT 40;`;

	params.unshift(req.body.session.username); // Add username to the beginning after params edited
	
	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		// Convert integer to boolean
		for(let i = 0; i < results.length; i++) {
			results[i].isPinned = !!results[i].isPinned;
		}
		
		res.status(200).json(results);
	});
});

const TOGGLEPIN_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_TOGGLEPIN_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.patch('/toggle-pin', TOGGLEPIN_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;
	
	let id = req.body.params.id;

	if (!id)
		return res.status(400).send('Missing argument(s)');

	users.isAdmin(req.body.session.username, res, () => {
		let sql = `UPDATE questions SET isPinned = NOT isPinned WHERE id = ?;`;
		let params = [id];

		pool.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			if (results && results.changedRows === 1)
				res.sendStatus(204);
			else
				res.sendStatus(404);
		});
	});
});

const PATCH_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_PATCH_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.patch('/', PATCH_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let id = req.body.params.id,
	    description = req.body.params.description,
	    tag = req.body.params.tag;

	if (!id || (!description && !tag))
		return res.status(400).send('Missing argument(s)');

	users.isAuthor(req.body.session.username, id, users.postType.QUESTION, res, () => {
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
		
		pool.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			if (results && results.changedRows === 1)
				res.sendStatus(204);
			else
				res.sendStatus(404);
		});
	});
});

const DELETE_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_DELETE_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.delete('/', DELETE_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let id = req.body.params.id;

	if (!id)
		return res.status(400).send('Missing argument(s)');

	users.isAuthor(req.body.session.username, id, users.postType.QUESTION, res, () => {
		let sql = `DELETE FROM questions WHERE id=?;`;
		let params = [id];

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
});

const MARKSOLVED_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_QSTNS_MARKSOLVED_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.patch('/mark-solved', MARKSOLVED_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let id = req.body.params.id,
	    solvedAnswerId = req.body.params.solvedAnswerId;

	if (!id || (!solvedAnswerId && solvedAnswerId != null) || (solvedAnswerId && solvedAnswerId.length !== 36))
		return res.status(400).send('Missing or out-of-bounds argument(s)');

	users.isAuthor(req.body.session.username, id, users.postType.QUESTION, res, () => {
		let sql = `UPDATE questions SET solvedAnswerId=? WHERE id=?;`;
		let params = [solvedAnswerId, id];

		pool.execute(sql, params, (err, results) => {
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
	});
});

module.exports = router;