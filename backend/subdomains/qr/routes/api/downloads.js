const express = require('express'),
      router = express.Router(),
      rateLimit = require('express-rate-limit'),
      path = require('path'),
      fs = require('fs');

const DOWNLOADS_RATE_LIMITER = rateLimit({
	windowMs: process.env.QR_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.QR_DOWNLOADS_LIMITER_MAX_REQUESTS,
	message: "Too many requests",
	headers: false
});

const downloadJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../components/downloads.json'), {encoding:'utf8', flag:'r'}));

router.get('/', DOWNLOADS_RATE_LIMITER, (req, res) => {
	res.status(200).json(downloadJSON);
});

module.exports = router;