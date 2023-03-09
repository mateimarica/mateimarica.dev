const express = require('express'),
      router = express.Router(),
      {authInspector, ROLE} = require('../authManager'),
      files = require('../files');

const pool = files.pool;

const selectVarcharLenSql = `SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME = 'notes' AND COLUMN_NAME = 'text'`;
router.get('/', authInspector(ROLE.USER), (req, res) => {
	pool.execute({sql: selectVarcharLenSql, rowsAsArray: true}, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
		if (results && results.length === 1) {
			const textColLength = results[0][0];
		
			const sql2 = `SELECT text, lastEdit FROM notes WHERE username=?`,
				params2 = [req.headers['Username']];

			pool.execute(sql2, params2, (err, results2) => {
				if (err) {
					console.log(err);
					return res.sendStatus(502);
				}

				if (results2 && results2.length === 1) {
					results2[0].textColLength = textColLength;
					return res.send(JSON.stringify(results2[0]));
				} else {
					const sql3 = `INSERT INTO notes (username) VALUES (?)`,
						params3 = [req.headers['Username']];

					pool.execute(sql3, params3, (err, results3) => {
						if (err) {
							console.log(err);
							return res.sendStatus(502);
						}

						if (results3 && results3.affectedRows === 1) {
							res.setHeader('Content-Type', 'application/json');
							return res.send(JSON.stringify({ text: '', lastEdit: null, textColLength: textColLength }));
						} else {
							return res.sendStatus(502);
						}
					});
				}
			});
		}
	});
});

// Pre-assign this query since this endpoint will be called often. Is this faster than just assigning it each time in the callback? Maybe slightly
const updateSql = `UPDATE notes SET text=?, lastEdit=CURRENT_TIMESTAMP() WHERE username=?`;
router.patch('/', authInspector(ROLE.USER), (req, res) => {
	const text = req.body.text;

	if (text === undefined || text.length > 65400) { // max length of VARCHAR field just under (2^16 - 1)
		return res.status(400).send('Text undefined or longer than 16200');
	}

	const params = [text, req.headers['Username']];

	pool.execute(updateSql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
	
		if (results && results.affectedRows === 1) {
			return res.status(204).send();
		} else {
			return res.sendStatus(502);
		}
	});
});

module.exports = router;