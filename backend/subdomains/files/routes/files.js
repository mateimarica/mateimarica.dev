const express = require('express'),
      router = express.Router(),
      {authInspector, ROLE} = require('../authManager'),
      sizeVerifier = require('../sizeVerifier')
      files = require('../files');

const pool = files.pool;

router.get('/', authInspector(ROLE.USER, ROLE.INVITEE), (req, res) => {

	// Getting the list of files
	switch (req.headers['Role']) {
		case ROLE.ADMIN:
			var sql = `SELECT baseName, name, ext, size, uploadDate, uploader, isInvited FROM files ORDER BY uploadDate DESC`;
			var params = [];
			break;
		case ROLE.USER:
			var sql = `SELECT baseName, name, ext, size, uploadDate, uploader, isInvited FROM files WHERE uploader=? ORDER BY uploadDate DESC`;
			var params = [req.headers['Username']];
			break;
		case ROLE.INVITEE:
			var sql = `SELECT baseName, name, ext, size, uploadDate, uploader, isInvited FROM files WHERE uploader=? AND isInvited=? ORDER BY uploadDate DESC`;
			var params = [req.headers['Username'], true];
			break;
	}

	pool.execute(sql, params, (err1, results1) => {
		if (err1) {
			console.log(err1);
			return res.sendStatus(502);
		}

		const role = req.headers['Role'];

		// Getting the usedSpace and maximum storage available for that user
		switch (role) {
			case ROLE.ADMIN:
			case ROLE.USER:
				sql = `SELECT COALESCE(CONVERT(SUM(size), SIGNED), 0) AS usedSpace FROM files`;
				params = [];
				break;
			case ROLE.INVITEE:
				sql = `SELECT COALESCE(CONVERT(SUM(size), SIGNED), 0) AS usedSpace FROM files WHERE uploader=? AND isInvited=?`;
				params = [req.headers['Username'], true];
				break;
		}

		pool.execute(sql, params, (err2, results2) => {
			if (err2) {
				console.log(err2);
				return res.sendStatus(502);
			}

			res.status(200).send({
				usedSpace: results2[0].usedSpace,
				totalSpace: (role === ROLE.INVITEE ? req.headers['MaxUploadSize'] : sizeVerifier.FILES_MAX_STORAGE_BYTES),
				files: results1
			});
		});
	});
});

module.exports = router;