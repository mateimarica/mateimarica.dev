const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      {authInspector, ROLE} = require('../authManager'),
      crypto = require('crypto'),
      templateEngine = require('template-engine'),
      files = require('../files');

const UPLOAD_DIR = files.UPLOAD_DIR;
const pool = files.pool;
	  
router.post('/', authInspector(ROLE.USER), (req, res) => {
	const name = req.body.name,
	      limit = req.body.limit,
	      validity = req.body.validity; // validity is in hours

	if (!name || 
	    !limit || !Number.isInteger(limit) || limit <= 0 || limit > 9999 || 
	    !validity || isNaN(validity) || validity <= 0 || validity > 9999)
		return res.sendStatus(400);

	const filePath = path.join(UPLOAD_DIR, 'users', req.headers['Username'], name);

	if (!fs.existsSync(filePath))
		return res.sendStatus(404);

	const id = crypto.randomBytes(16).toString('hex');

	const sql = `INSERT INTO shares (id, baseName, expirationDate, maxDownloads, sharer) ` +
	            `VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE), ?, ?)`,
	      params = [id, name, validity * 60, limit, req.headers['Username']];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.affectedRows === 1) {
			const url = req.protocol + '://' + req.get('host') + '/share?id=' + id;

			return res.status(201).send({url: url});
		} else {
			return res.sendStatus(409);
		}
	});
});

router.get('/', (req, res) => {
	const id = req.query.id;

	if (!id)
		return res.sendStatus(400);

	const url = req.protocol + '://' + req.get('host') + '/share/download?id=' + id;

	const html = templateEngine.fillHTML(
		path.join(__dirname, '..', 'components', 'download.html'),
		{ url: url }
	)
	res.send(html);
});

router.get('/download', (req, res) => {
	const id = req.query.id;

	if (!id)
		return res.sendStatus(400);

	const sql = `SELECT baseName, expirationDate, maxDownloads, downloads, sharer FROM shares WHERE id=?`,
	     params = [id];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}

		if (results && results.length === 1) {
			const currentDate = new Date(),
			      expirationDate = new Date(results[0].expirationDate);

			const downloadsAvailable = results[0].maxDownloads - results[0].downloads;
			if (currentDate > expirationDate || downloadsAvailable < 1) {
				res.sendStatus(404);
				pool.execute(`DELETE FROM shares WHERE id=?`, params, (err) => {
					if (err) console.log(err);
				});
				return;
			}

			const filePath = path.join(UPLOAD_DIR, 'users', results[0].sharer, results[0].baseName);

			if (!fs.existsSync(filePath)) {
				res.sendStatus(410);
				pool.execute(`DELETE FROM shares WHERE id=?`, params, (err) => {
					if (err) console.log(err);
				});
				return;
			}
			
			res.download(filePath);
			
			if (downloadsAvailable === 1) {
				pool.execute(`DELETE FROM shares WHERE id=?`, params, (err) => {
					if (err) console.log(err);
				});
			} else {
				pool.execute(`UPDATE shares SET downloads=downloads+1 WHERE id=?`, params, (err) => {
					if (err) console.log(err);
				});
			}
			return;
		}

		return res.sendStatus(404);
	});
});

module.exports = router;