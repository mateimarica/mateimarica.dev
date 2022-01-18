const express = require('express'),
      router = express.Router(),
      authManager = require('../authManager'),
      files = require('../files');

const pool = files.pool;

router.post('/', (req, res) => {
	const username = req.get('Username'),
	      password = req.get('Authorization');

	if (!username || (!password && password !== '')) 
		res.sendStatus(400);

	const sql = `SELECT username, role FROM users where username=? AND password=SHA1(?)`,
	      params = [username, password];

	pool.execute({sql: sql, rowsAsArray: true}, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length === 1) {
			res.set('Authorization', authManager.createNewSession(username));
			res.sendStatus(200);
		} else {
			res.sendStatus(401);	
		}
	});
});

module.exports = router;