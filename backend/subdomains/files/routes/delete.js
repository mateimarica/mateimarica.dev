const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      {authInspector, ROLE} = require('../authManager'),
      files = require('../files');

const UPLOAD_DIR = files.UPLOAD_DIR;
const pool = files.pool;

router.delete('/', authInspector(ROLE.INVITEE, ROLE.USER), (req, res) => {
	let filename = req.get('Filename'),
	      uploader = req.get('Uploader'),
	      isInvited = req.get('IsInvited'); // isInvited is 0 or 1

	if (!filename || !uploader || !isInvited || isNaN(isInvited) || (isInvited != 0 && isInvited != 1))
		return res.sendStatus(400);

	isInvited = !!Number(isInvited);

	const role = req.headers['Role'];

	// If role=USER or role=INVITEE and username doesn't match uploader
	// or if role=INVITEE and file isn't invited
	if (((role === ROLE.USER || role === ROLE.INVITEE) && req.headers['Username'] !== uploader) ||
		((role === ROLE.INVITEE && !isInvited)))
		return res.status(403).send("Can't delete another user's file");

	switch (req.headers['Role']) {
		case ROLE.ADMIN:
			var sql = `DELETE FROM files WHERE baseName=?`;
			var params = [filename];
			var filepath = path.join(UPLOAD_DIR, (isInvited ? 'invited' : 'users'), uploader, filename);
			break;
		case ROLE.USER:
			var sql = `DELETE FROM files WHERE baseName=? AND uploader=?`;
			var params = [filename, req.headers['Username']];
			var filepath = path.join(UPLOAD_DIR, 'users', req.headers['Username'], filename);
			break;
		case ROLE.INVITEE:
			var sql = `DELETE FROM files WHERE baseName=? AND uploader=?`;
			var params = [filename, req.headers['Username']];
			var filepath = path.join(UPLOAD_DIR, 'invited', req.headers['Username'], filename);
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