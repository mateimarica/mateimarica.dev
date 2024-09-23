'use strict';

const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      { authInspector, ROLE } = require('../authManager'),
      crypto = require('crypto'),
      { UPLOAD_DIR } = require('../files'),
      { isText } = require('istextorbinary'),
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
			const downloadSession = downloadSessions[i];

			if (currentDate - downloadSession.dateCreated < downloadSession.validityPeriod) {
				if (!fs.existsSync(downloadSession.filePath))
					return res.sendStatus(410);

				if (downloadSession.type === 'download') {
					res.download(downloadSession.filePath, { dotfiles: 'allow' });
					downloadSessions.splice(i, 1); // downloads are a one-time link, so remove immediately
				} else if (downloadSession.type === 'preview') {
					if (downloadSession.isPreviewableFile) {
						res.sendFile(downloadSession.filePath, { dotfiles: 'allow', headers: { "Content-Disposition": `inline; filename="${path.basename(downloadSession.filePath)}"`} } );
					} else {
						res.status(200).send("<pre>This file cannot be previewed.</pre>");
					}
				} else {
					res.sendStatus(400);
				}

				return;
			} else {
				res.sendStatus(400);
				downloadSessions.splice(i, 1);
				return;
			}
		}
	}

	return res.sendStatus(400);
});

let downloadSessions = [];

const requestValidities = {
	'download': 3000,
	'preview': 3600000 // 1 hour
};

const renderableExts = ['.jpeg', '.jpg', '.png', '.webp', '.apng', '.pdf', '.bmp', '.ico']; // not including text files

router.post('/request', authInspector(ROLE.USER), (req, res) => {
	let baseName = req.body.baseName;
	let type = req.body.type; // possible values: download, preview

	if (!baseName || !type || !Object.keys(requestValidities).includes(type))
		return res.sendStatus(400);

	const filePath = path.join(UPLOAD_DIR, req.headers['Username'], baseName);

	if (!fs.existsSync(filePath))
		return res.sendStatus(404);

	let isPreviewableFile = null;
	if (type === 'preview')
		isPreviewableFile = renderableExts.includes(path.extname(baseName)) || isText(null, fs.readFileSync(filePath));

	const downloadSession = {
		key: crypto.randomBytes(48).toString('hex'),
		dateCreated: new Date(),
		filePath: filePath,
		type: type,
		validityPeriod: requestValidities[type],
		isPreviewableFile: isPreviewableFile
	};

	downloadSessions.push(downloadSession);

	res.set('Authorization', downloadSession.key);
	res.sendStatus(200);
});

module.exports = router;