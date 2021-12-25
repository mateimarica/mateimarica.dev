const express = require('express'),
      router = express.Router(),
      connectionWrapper = require('../../../../helpers/connectionWrapper'),
      users = require('./users');

router.post('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let recipient = req.body.params.recipient,
		message = req.body.params.message;

	if (!recipient || !message || message.length > 3500)
		return res.status(400).send('Missing or out-of-bounds argument(s)');
	
	connectionWrapper((connection) => {
		let sql = `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?);`;
		let params = [req.body.session.username, recipient, message];

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

router.get('/', (req, res) => {
	if (!req.body || !req.body.params)
		return res.sendStatus(400);

	if (!users.isSessionValid(req.body.session))
		return res.sendStatus(401);

	let recipient = req.body.params.recipient;

	if (!recipient)
		return res.status(400).send('Missing argument(s)');
	
	connectionWrapper((connection) => {
		let sql = 
			`SELECT * FROM messages ` +
			`WHERE ((recipient=? AND sender=?) OR (recipient=? AND sender=?)) ` +
			`ORDER BY dateCreated ASC;`;
		let params = [req.body.session.username, recipient, recipient, req.body.session.username];

		connection.execute(sql, params, (err, results) => {
			if (err) {
				switch (err.code) {
					case 'ER_NO_REFERENCED_ROW_2':
						return res.sendStatus(404);
				}
				console.log(err);
				return res.sendStatus(500);
			}

			res.status(200).json(results);
		});
	}, res, false, process.env.QR_DB_NAME);
});

module.exports = router;