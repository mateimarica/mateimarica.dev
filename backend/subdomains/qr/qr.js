const express = require('express'),
      router = express.Router(),
      path = require('path'),
      mysql = require('mysql2'),
      rateLimit = require('express-rate-limit'),
      templateEngine = require('template-engine'),
      reqSniffer = require('request-sniffer'),
      downloads = require('./routes/api/downloads');	

const STATIC_PAGE_RATE_LIMITER = rateLimit({
		windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
		max: process.env.QR_STATIC_LIMITER_MAX_REQUESTS * process.env.QR_NUM_OF_STATIC_FILES,
		message: "Too many requests, try again later.",
		headers: false
});

router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));

router.get('/index.html', STATIC_PAGE_RATE_LIMITER, (req, res) => {
	res.redirect('/');
});

router.get('/', STATIC_PAGE_RATE_LIMITER, (req, res) => {
	let downloadInfo = downloads.getDownloadInfo();
	const html = templateEngine.fillHTML(
		path.join(__dirname, '../../../frontend/build/qrequest/index.html'),
		{
			windows: downloadInfo.downloads.windows.browser_download_url ?? '/',
			linux: downloadInfo.downloads.linux.browser_download_url ?? '/',
			macos: downloadInfo.downloads.macos.browser_download_url ?? '/',
			version: downloadInfo.version ?? 'v1.0'
		}
	)
	res.send(html);
});

router.use('/', STATIC_PAGE_RATE_LIMITER);

router.use(express.static(path.join(__dirname, '../../../frontend/build/qrequest')));
router.use('/api/users', require('./routes/api/users').router);
router.use('/api/questions', require('./routes/api/questions'));
router.use('/api/answers', require('./routes/api/answers'));
router.use('/api/votes', require('./routes/api/votes'));
router.use('/api/reports', require('./routes/api/reports'));
router.use('/api/messages', require('./routes/api/messages'));
router.use('/api/downloads', require('./routes/api/downloads').router);

router.get('*', (req, res) => { // Send 404 page for any other page
	res.status(404).sendFile(path.join(__dirname, '../../components/404.html'));
	reqSniffer.recordSuspiciousIP(req);
});

router.use('*', (req, res) => {
	res.sendStatus(404);
	reqSniffer.recordSuspiciousIP(req);
});

module.exports = router;