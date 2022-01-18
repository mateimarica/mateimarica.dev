const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      authManager = require('../authManager'),
      { atob } = require('buffer'),
      crypto = require('crypto'),
      files = require('../files');

const UPLOAD_DIR = files.UPLOAD_DIR;

router.get('/',  (req, res) => {
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

router.get('/request', authManager.authInspector, (req, res) => {
	if (!req.query.name)
		return res.sendStatus(400);

	const filePath = path.join(UPLOAD_DIR, atob(req.query.name));

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