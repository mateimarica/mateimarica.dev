const express = require('express'),
      router = express.Router(),
      rateLimit = require('express-rate-limit'),
      poolManager = require('pool-manager'),
      path = require('path'),
      authInspector = require('./authManager');

const pool = poolManager.getPool('searchicton_db');

const GENERAL_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.SEARCHICTON_GENERAL_LIMITER_MAX_REQUESTS,
	headers: false
});

const FAILED_AUTH_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_LOGIN_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_LOGIN_LIMITER_MAX_FAILED_REQUESTS,
	headers: false,
	skipSuccessfulRequests: true
});

router.use(GENERAL_RATE_LIMITER);
router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));

router.get('/index.html', (req, res) => res.redirect('/'));
router.use(express.static(path.join(__dirname, '../../../frontend/searchicton')));

router.get('/landmarks', (req, res) => {
	const sql = `SELECT * FROM landmarks`;
	pool.execute(sql, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
		return res.status(200).send(results);
	});
});

router.get('/', (req, res) => {
	res.sendStatus(200);
});

router.post('/landmarks', FAILED_AUTH_RATE_LIMITER, authInspector, (req, res) => {
	if (!req.body)
		return res.sendStatus(400);

	let title = req.body.title,
	    description = req.body.description,
	    points = req.body.points,
	    category = req.body.category,
	    longitude = req.body.longitude,
	    latitude = req.body.latitude;

	if (!title || title.length < 1 || title.length > 255
	 || !description ||	description.length < 1 || description.length > 1000
	 || !points || !Number.isInteger(points)
	 || !category || category.length < 1 || category.length > 255
	 || !longitude || isNaN(longitude)
	 || !latitude || isNaN(latitude)) {
		return res.status(400).send('Invalid arguments');
	 }

	const sql = `INSERT INTO landmarks (title, description, points, category, longitude, latitude) VALUES (?, ?, ?, ?, ?, ?)`;
	const params = [title, description, points, category, longitude, latitude];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
		return res.sendStatus(201);
	});
});

router.delete('/landmarks', FAILED_AUTH_RATE_LIMITER, authInspector, (req, res) => {
	if (!req.body)
		return res.sendStatus(400);

	let id = req.body.id;

	if (!id || id.length != 36) {
		return res.status(400).send('id length must be 36');
	 }

	const sql = `DELETE FROM landmarks WHERE id=?`;
	const params = [id];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
		if (results && results.affectedRows === 1) {
			return res.sendStatus(204);
		} else {
			return res.sendStatus(404);
		}
	});
});

module.exports = router;