const express = require('express'),
      router = express.Router(),
      { authInspector, ROLE } = require('../authManager'),
      { pool } = require('../files');

router.get('/', authInspector(ROLE.USER, ROLE.INVITEE), (req, res) => {

	const username = req.headers['Username'],
	      inviteId = req.headers['InviteId'];

	// Getting the list of files
	switch (req.headers['Role']) {
		case ROLE.ADMIN: // for now, admin only sees their own files
		case ROLE.USER:
			var sql = `SELECT baseName, name, ext, size, uploadDate, uploader, inviteId FROM files WHERE uploader=? ORDER BY uploadDate DESC`;
			var params = [username];
			break;
		case ROLE.INVITEE:
			var sql = `SELECT baseName, name, ext, size, uploadDate, uploader, inviteId FROM files WHERE uploader=? AND BINARY inviteId=? ORDER BY uploadDate DESC`;
			var params = [username, inviteId];
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
				sql = `SELECT (SELECT COALESCE(CONVERT(SUM(size), SIGNED), 0) FROM files WHERE uploader=?) AS usedSpace, (SELECT space FROM users WHERE username=?) AS totalSpace`;
				params = [username, username];
				break;
			case ROLE.INVITEE:
				sql = `SELECT COALESCE(CONVERT(SUM(size), SIGNED), 0) AS usedSpace FROM files WHERE uploader=? AND BINARY inviteId=?`;
				params = [username, inviteId];
				break;
		}

		pool.execute(sql, params, (err2, results2) => {
			if (err2) {
				console.log(err2);
				return res.sendStatus(502);
			}

			res.status(200).send({
				usedSpace: results2[0].usedSpace,
				totalSpace: (role === ROLE.INVITEE ? req.headers['MaxUploadSize'] : results2[0].totalSpace),
				files: results1
			});
		});
	});
});

module.exports = router;