'use strict';

const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      { authInspector, ROLE } = require('../authManager'),
      crypto = require('crypto'),
      { UPLOAD_DIR } = require('../files'),
      rateLimit = require('express-rate-limit');

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

				res.download(downloadSessions[i].filePath, { dotfiles: 'allow' });
				downloadSessions.splice(i, 1);
				return;
			} else {
				return res.sendStatus(401);
			}
		}
	}

	return res.sendStatus(400);
});

let downloadSessions = [];

router.post('/request', authInspector(ROLE.USER), (req, res) => {
	let baseName = req.body.baseName;

	if (!baseName)
		return res.sendStatus(400);

	const filePath = path.join(UPLOAD_DIR, req.headers['Username'], baseName);

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