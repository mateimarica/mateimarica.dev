const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      {authInspector, ROLE} = require('../authManager'),
      files = require('../files');

const UPLOAD_DIR = files.UPLOAD_DIR;
const pool = files.pool;

router.delete('/', authInspector(ROLE.INVITEE, ROLE.USER), (req, res) => {
	let baseName = req.body.baseName,
	    uploader = req.body.uploader,
	    inviteId = req.body.inviteId;

	if (!baseName || !uploader)
		return res.sendStatus(400);

	const role = req.headers['Role'];

	// If role=USER or role=INVITEE and username doesn't match uploader
	// or if role=INVITEE and file isn't invited
	if (((role === ROLE.USER || role === ROLE.INVITEE) && req.headers['Username'] !== uploader) 
	  || (role === ROLE.INVITEE && !inviteId))
		return res.status(403).send("Can't delete another user's file");

	switch (req.headers['Role']) {
		case ROLE.ADMIN:
		case ROLE.USER:
			var sql = `DELETE FROM files WHERE baseName=? AND uploader=?`;
			var params = [baseName, req.headers['Username']];
			var filepath = path.join(UPLOAD_DIR, req.headers['Username'], baseName);
			break;
		case ROLE.INVITEE:
			var sql = `DELETE FROM files WHERE baseName=? AND uploader=? AND BINARY inviteId=?`;
			var params = [baseName, req.headers['Username'], req.headers['InviteId']];
			var filepath = path.join(UPLOAD_DIR, req.headers['Username'], baseName);
			break;
	}

	if (fs.unlinkSync(filepath)) {
		return res.sendStatus(404);
	}

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