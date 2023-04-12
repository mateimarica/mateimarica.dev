'use strict';

const express = require('express'),
      router = express.Router(),
      rateLimit = require("express-rate-limit"),
      poolManager = require('pool-manager'),
      users = require('./users');

const pool = poolManager.getPool(process.env.QR_DB_NAME);
	
const POST_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_ANS_POST_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.post('/', POST_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let answer = req.body.params.answer,
	    questionId = req.body.params.questionId;

	if (!answer || answer.length < 1 || answer.length > 3500 
	 || !questionId || questionId.length !== 36) {
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	}

	let sql = `INSERT INTO answers (answer, questionId, author) VALUES (?, ?, ?);`;

	let params = [answer, questionId, req.body.session.username];
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
	max: process.env.QR_ANS_GET_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

// Get all answers for a question
router.get('/', GET_RATE_LIMITER, (req, res) => {
	if (!req.body)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;
	
	let questionId = req.body.params.questionId;

	if (!questionId)
		return res.status(400).send('Missing argument(s)');

	let sql = 
		`SELECT a.*, ` +
		`COALESCE((SELECT CONVERT(SUM(vote), SIGNED) FROM votes WHERE answerId=a.id), 0) AS votes, ` +
		`COALESCE((SELECT vote FROM votes WHERE answerId=a.id AND voter=?), 0) AS currentUserVote ` +
		`FROM answers AS a WHERE a.questionId=? ` +
		`ORDER BY votes DESC LIMIT 35;`;

	let params = [req.body.session.username, questionId];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		res.status(200).json(results);
	});
});

const PATCH_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_ANS_PATCH_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.patch('/', PATCH_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let answer = req.body.params.answer,
	    id = req.body.params.id;

	if (!answer || answer.length < 1 || answer.length > 3500 || !id) 
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	
	users.isAuthor(req.body.session.username, id, users.postType.ANSWER, res, () => {
		let sql = `UPDATE answers SET answer=? WHERE id=?;`;
		let params = [answer, id];

		pool.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(500);
			}

			res.sendStatus(204);
		});
	});
});

const DELETE_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_ANS_DELETE_LIMITER_MAX_REQUESTS,
	message: "You're doing that too much. Try again in a bit.",
	headers: false
});

router.delete('/', DELETE_RATE_LIMITER, (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session, res)) return;

	let id = req.body.params.id;

	if (!id)
		return res.status(400).send('Missing argument');
	
	users.isAuthor(req.body.session.username, id, users.postType.ANSWER, res, () => {
		let sql = `DELETE FROM answers WHERE id=?;`;
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

module.exports = router;