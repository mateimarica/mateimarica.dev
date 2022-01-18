const express = require('express'),
      router = express.Router(),
      authManager = require('../authManager'),
      sizeVerifier = require('../sizeVerifier')
      files = require('../files');

const pool = files.pool;

router.get('/', authManager.authInspector, (req, res) => {
	pool.execute(`SELECT baseName, name, ext, size, uploadDate, uploader FROM files ORDER BY uploadDate DESC`, (err1, results1) => {
		if (err1) {
			console.log(err1);
			return res.sendStatus(502);
		}

		pool.execute(`SELECT COALESCE(CONVERT(SUM(size), SIGNED), 0) AS usedSpace FROM files`, (err2, results2) => {
			if (err2) {
				console.log(err2);
				return res.sendStatus(502);
			}

			res.status(200).send({
				usedSpace: results2[0].usedSpace,
				totalSpace: sizeVerifier.FILES_MAX_STORAGE_BYTES,
				files: results1
			});

		});
	});
});

module.exports = router;