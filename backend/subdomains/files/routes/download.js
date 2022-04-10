const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      {authInspector, ROLE} = require('../authManager'),
      { atob } = require('buffer'),
      crypto = require('crypto'),
      files = require('../files'),
      rateLimit = require('express-rate-limit');

const UPLOAD_DIR = files.UPLOAD_DIR;

const DOWNLOADS_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_DOWNLOADS_LIMITER_MAX_REQUESTS,
	headers: false
});

router.get('/', DOWNLOADS_RATE_LIMITER, (req, res) => {
	if (!req.query.key)
		return res.sendStatus(400);

	const currentDate = new Date();
	for (let i = 0; i < downloadSessions.length; i++) {
		if (req.query.key === downloadSessions[i].key) {
			if (currentDate - downloadSessions[i].dateCreated < 3000) {
				if (!fs.existsSync(downloadSessions[i].filePath))
					return res.sendStatus(410);

				res.download(downloadSessions[i].filePath);
				downloadSessions.splice(i, 1);
				return;
			} else {
				return sendStatus(401);
			}
		}
	}

	return res.sendStatus(400);
});

let downloadSessions = [];

router.post('/request', authInspector(ROLE.USER), (req, res) => {
	let baseName = req.body.baseName,
	    uploader = req.body.uploader,
	    isInvited = req.body.isInvited; // isInvited is 0 or 1

	if (!baseName || !uploader || (isInvited !== 0 && isInvited !== 1))
		return res.sendStatus(400);


	if (req.headers['Role'] === ROLE.USER && req.headers['Username'] !== uploader)
		return res.status(403).send("Can't download another user's file when role=user");

	const filePath = path.join(UPLOAD_DIR, (isInvited ? 'invited' : 'users'), uploader, baseName);

	if (!fs.existsSync(filePath))
		return res.sendStatus(404);

	const downloadSession = {
		key: crypto.randomBytes(16).toString('hex'),
		dateCreated: new Date(),
		filePath: filePath
	};

	downloadSessions.push(downloadSession);
	
	res.set('Authorization', downloadSession.key);
	res.sendStatus(200);
});

module.exports = router;