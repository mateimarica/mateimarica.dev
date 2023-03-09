const express = require('express'),
      router = express.Router(),
      {authInspector, ROLE} = require('../authManager'),
      files = require('../files'),
      { nanoid } = require('nanoid');

const pool = files.pool;

let textMaxLength = 16200; // most probably the max length
async function setTextMaxLength() {
	const sql = `SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_NAME = 'notes' AND COLUMN_NAME = 'text'`;

	pool.execute({sql: sql, rowsAsArray: true}, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
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
			results[0].textMaxLength = textMaxLength;
			results[0].pollerId = nanoid(7);
			return res.send(JSON.stringify(results[0]));
		} else {
			const sql2 = `INSERT INTO notes (username) VALUES (?)`,
				params2 = [req.headers['Username']];

			pool.execute(sql2, params2, (err, results2) => {
				if (err) {
					console.log(err);
					return res.sendStatus(502);
				}

				if (results2 && results2.affectedRows === 1) {
					return res.send(JSON.stringify({ text: '', lastEdit: null, textMaxLength: textMaxLength, pollerId: nanoid(7) }));
				} else {
					return res.sendStatus(502);
				}
			});
		}
	});
});

const pollers = {}; // all the requests waiting for a response

// long polling
router.post('/poll', authInspector(ROLE.USER), (req, res) => {
	const pollerId = req.body.pollerId;
	if (!pollerId || pollerId.length !== 7)
		return res.sendStatus(400);

	res.setHeader('Content-Type', 'application/json');
	pollers[pollerId] = {
		username: req.headers['Username'],
		req: req,
		res: res,
		timeCreated: new Date()
	};
});

async function notifyPollers(username, text, pollerId) {
	// make a shallow copy so that this operation is atomic
	// we don't want the pollers array to change while we're iterating through it
	const pollersCopy = pollers;
	const keys = Object.keys(pollersCopy);
	const len = keys.length;
	for (let i = 0; i < len; i++) {
		const key = keys[i];
		if (key === pollerId) continue; // skip this poller if they triggered this update
		const poller = pollersCopy[key];
		if (poller.username === username) {
			delete pollers[key]; // delete this poller since we're now returning a response
			if (poller.req._readableState.errored || poller.res.writableEnded) continue; // if the request errored (eg: timed out) or response already sent, go to next iteration
			poller.res.send(JSON.stringify({ text: text }));
		}
	}
}

const cleanupPollersIntervalMilli = process.env.FILES_NOTES_POLLER_CLEANUP_INTERVAL_MINS * 60 * 1000,
      requestTimeoutMilli = process.env.REQUEST_TIMEOUT_MINS * 60 * 1000;
async function cleanupPollers() {
	const pollersCopy = pollers;
	const keys = Object.keys(pollersCopy);
	const len = keys.length;
	const currentDate = new Date();
	for (let i = 0; i < len; i++) {
		const key = keys[i];
		const poller = pollersCopy[key];
		if (currentDate - poller.timeCreated > requestTimeoutMilli) {
			delete pollers[key];
			if (poller.req._readableState.errored || poller.res.writableEnded) continue;
			poller.res.status(408).send(); // 408 timeout
		}
	}
}

setInterval(cleanupPollers, cleanupPollersIntervalMilli)

// Pre-assign this query since this endpoint will be called often. Is this faster than just assigning it each time in the callback? Maybe slightly
const updateSql = `UPDATE notes SET text=?, lastEdit=CURRENT_TIMESTAMP() WHERE username=?`;
router.patch('/', authInspector(ROLE.USER), (req, res) => {
	const text = req.body.text,
	      pollerId = req.body.pollerId;

	if (text === undefined || text.length > 65400) { // max length of VARCHAR field just under (2^16 - 1)
		return res.status(400).send('Text undefined or longer than 16200');
	}

	if (!pollerId || pollerId.length !== 7) {
		return res.sendStatus(400);
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
			notifyPollers(username, text, pollerId);
			return;
		} else {
			return res.sendStatus(502);
		}
	});
});

module.exports = router;