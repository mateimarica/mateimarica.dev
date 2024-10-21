'use strict';

const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      { authInspector, ROLE } = require('../authManager'),
      { pool, UPLOAD_DIR, COMPONENTS_DIR } = require('../files'),
	  { nanoid } = require('nanoid');

require('@marko/compiler/register');

router.post('/', authInspector(ROLE.USER), (req, res) => {
	const name = req.body.name,
	      limit = req.body.limit,
	      validity = req.body.validity, // validity is in hours
	      forceDownload = req.body.forceDownload;

	// limit and validity using null check instead of ! because their values can be zero, and !0 is true
	if (!name ||
	    limit === null || !Number.isInteger(limit) || limit < 0 || limit > 9999 ||
	    validity === null || isNaN(validity) || validity < 0 || validity > 9999 ||
	    typeof forceDownload !== 'boolean')
		return res.sendStatus(400);

	const filePath = path.join(UPLOAD_DIR, req.headers['Username'], name);

	if (!fs.existsSync(filePath))
		return res.sendStatus(404);

	const id = nanoid(7);

	const sql = `INSERT INTO shares (id, baseName, expirationDate, maxDownloads, sharer, forceDownload) ` +
	            `VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE), ?, ?, ?)`,
	      params = [id, name, validity * 60 || null, limit || null, req.headers['Username'], forceDownload]; // the "|| null" is for passing null if the value is zero

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.affectedRows === 1) {
			const url = req.protocol + '://f.mateimarica.dev' + '/s' + (!forceDownload ? '/dl' : '') + '?id=' + id;
			return res.status(201).send({url: url});
		} else {
			return res.sendStatus(409);
		}
	});
});

const downloadPageTemplate = require(path.join(COMPONENTS_DIR, 'download')).default;
// Sends a download page that redirects to the download URL
router.get('/', (req, res) => {
	const id = req.query.id;

	if (!id)
		return res.sendStatus(400);

	const url = req.protocol + '://' + req.get('host') + '/share/dl?id=' + id;
	const html = downloadPageTemplate.renderToString({ url: url });
	res.send(html);
});

// The actual download link
router.get('/dl', (req, res) => {
	const id = req.query.id;

	if (!id)
		return res.sendStatus(400);

	// BINARY cast so id comparison is case sensitive
	const sql = `SELECT baseName, expirationDate, maxDownloads, downloads, sharer, forceDownload FROM shares WHERE BINARY id=?`,
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
			const infiniteDownloads = (results[0].maxDownloads === null);
			const noExpiration = (results[0].expirationDate === null);

			// delete share if expired
			if (!noExpiration && currentDate > expirationDate) {
				res.sendStatus(404);
				pool.execute(`DELETE FROM shares WHERE BINARY id=?`, params, (err) => {
					if (err) console.log(err);
				});
				return;
			}

			const filePath = path.join(UPLOAD_DIR, results[0].sharer, results[0].baseName);

			// delete share if file doesn't exist
			if (!fs.existsSync(filePath)) {
				res.sendStatus(410);
				pool.execute(`DELETE FROM shares WHERE BINARY id=?`, params, (err) => {
					if (err) console.log(err);
				});
				return;
			}

			// set file to be send in response
			if (results[0].forceDownload) {
				res.status(200).download(filePath); // download() automatically sets Content-Disposition: attachment; filename=<name>
			} else {
				res.set('Content-Disposition', `filename="${results[0].baseName}"`);
				res.status(200).sendFile(filePath);
			}

			// delete share if this is the last download, otherwise increment
			if (downloadsAvailable === 1 && !infiniteDownloads) {
				pool.execute(`DELETE FROM shares WHERE BINARY id=?`, params, (err) => {
					if (err) console.log(err);
				});
			} else {
				pool.execute(`UPDATE shares SET downloads=downloads+1 WHERE BINARY id=?`, params, (err) => {
					if (err) console.log(err);
				});
			}
			return;
		}

		return res.sendStatus(404);
	});
});

router.get('/list', authInspector(ROLE.USER), (req, res) => {

	switch (req.headers['Role']) {
		case ROLE.ADMIN:
			var sql = `SELECT baseName, expirationDate, maxDownloads, downloads, sharer FROM shares`;
			var params = [];
			break;
		case ROLE.USER:
			var sql = `SELECT baseName, expirationDate, maxDownloads, downloads, sharer FROM shares WHERE sharer=? `;
			var params = [req.headers['Username']];
			break;

	}

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		res.status(200).send(results);
	});
});

module.exports = router;