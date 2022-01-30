const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      authManager = require('../authManager'),
      { atob } = require('buffer'),
      files = require('../files');

const UPLOAD_DIR = files.UPLOAD_DIR;
const pool = files.pool;

router.delete('/', authManager.authInspector, (req, res) => {
	const filename = req.get('Filename');

	if (!filename)
		return res.sendStatus(400);

	const filePath = path.join(UPLOAD_DIR, filename);

	if (fs.unlinkSync(filePath)) {
		return res.sendStatus(404);
	}

	const sql = `DELETE FROM files WHERE baseName=?`,
	      params = [filename];

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