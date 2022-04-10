const express = require('express'),
      router = express.Router(),
      authManager = require('../authManager'),
      files = require('../files'),
      path = require('path'),
      { atob } = require('buffer'),
      rateLimit = require('express-rate-limit');

const pool = files.pool;

const FAILED_LOGIN_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_LOGIN_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_LOGIN_LIMITER_MAX_FAILED_REQUESTS,
	headers: false,
	skipSuccessfulRequests: true
});

router.post('/', FAILED_LOGIN_RATE_LIMITER, (req, res) => {
	const username = req.get('Username'),
	      password = atob(req.get('Authorization'));

	if (!username || (!password && password !== '')) 
		res.sendStatus(400);

	const sql = `SELECT username, role FROM users where username=? AND password=SHA1(?)`,
	      params = [username, password];

	pool.execute({sql: sql}, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length === 1) {
			res.set('Authorization', authManager.createNewSession(username, results[0].role));
			res.status(200).sendFile(path.join(files.COMPONENTS_DIR, 'main.html'));
		} else {
			res.sendStatus(401);	
		}
	});
});

module.exports = router;