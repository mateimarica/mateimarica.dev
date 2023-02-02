const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      poolManager = require('pool-manager'),
      authManager = require('./authManager')
      rateLimit = require('express-rate-limit'),
      cookieParser = require('cookie-parser');

const pool = poolManager.getPool('files_db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const COMPONENTS_DIR = path.join(__dirname, '../../frontend_build/files_components');

if (!fs.existsSync(UPLOAD_DIR))
	fs.mkdirSync(UPLOAD_DIR);

// const limits = {
// 	fileSize: 1024 * 1024, // 1 MB (max file size)
// };

const GENERAL_RATE_LIMITER = rateLimit({
	windowMs: process.env.GENERAL_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_GENERAL_LIMITER_MAX_REQUESTS,
	headers: false
});

router.use(GENERAL_RATE_LIMITER);
router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));
router.use(cookieParser(process.env.FILES_SIGNED_COOKIE_SECRET));

router.get('/index.html', (req, res) => res.redirect('/'));

router.use(express.static(path.join(__dirname, '../../frontend_build/files')));

module.exports = { router, pool, UPLOAD_DIR, COMPONENTS_DIR };

router.use('/login', require('./routes/login'));
router.use('/files', require('./routes/files'));
router.use('/upload', require('./routes/upload'));
router.use('/download', require('./routes/download'));
router.use('/share', require('./routes/share'));
router.use('/delete', require('./routes/delete'));
router.use('/invite', require('./routes/invite'));