const express = require('express'),
      router = express.Router(),
      { authInspector, ROLE } = require('../authManager'),
      { createPoll, syncUserPollers } = require('../pollManager'),
	  { pool } = require('../files'),
      { nanoid } = require('nanoid');

let textMaxLength = 16200; // most probably the max length
async function setTextMaxLength() {
	const sql = `SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME = 'notes' AND COLUMN_NAME = 'text'`;

	pool.execute({sql: sql, rowsAsArray: true}, (err, results) => {
		if (err) {
			console.log(err);
			return;
		}

		if (results && results.length === 1) {
			textMaxLength = results[0][0];
		} else {
			console.log('Failed to retrieve length of text varchar length in notes table');
		}
	});
}
setTextMaxLength();

router.get('/', authInspector(ROLE.USER), (req, res) => {
	const sql = `SELECT text, lastEdit FROM notes WHERE username=?`,
	      params = [req.headers['Username']];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length === 1) {
			return res.json({
				notes: results[0].text,
				lastEdit: results[0].lastEdit,
				textMaxLength: textMaxLength,
				pollerId: nanoid(7)
			});
		} else {
			const sql2 = `INSERT INTO notes (username) VALUES (?)`,
				params2 = [req.headers['Username']];

			pool.execute(sql2, params2, (err, results2) => {
				if (err) {
					console.log(err);
					return res.sendStatus(502);
				}

				if (results2 && results2.affectedRows === 1) {
					return res.json({ notes: '', lastEdit: null, textMaxLength: textMaxLength, pollerId: nanoid(7) });
				} else {
					return res.sendStatus(502);
				}
			});
		}
	});
});

router.post('/poll', authInspector(ROLE.USER), (req, res) => createPoll(req, res));

// Pre-assign this query since this endpoint will be called often. Is this faster than just assigning it each time in the callback? Maybe slightly
const updateSql = `UPDATE notes SET text=?, lastEdit=CURRENT_TIMESTAMP() WHERE username=?`;
router.patch('/', authInspector(ROLE.USER), (req, res) => {
	const text = req.body.text,
	      pollerId = req.body.pollerId;

	if (text === undefined || text.length > 65400) { // max length of VARCHAR field just under (2^16 - 1)
		return res.status(400).send('Text undefined or longer than 16200');
	}

	if (!pollerId || pollerId.length !== 7) {
		return res.status(400).send('Missing pollerId in request body. Call GET /notes first to get one');;
	}

	const username = req.headers['Username'];
	const params = [text, username];

	pool.execute(updateSql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
	
		if (results && results.affectedRows === 1) {
			res.status(204).send();
			syncUserPollers(username, pollerId, { notes: text });
			return;
		} else {
			return res.sendStatus(502);
		}
	});
});

module.exports = router;