const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      poolManager = require('pool-manager');

const pool = poolManager.getPool('files_db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const COMPONENTS_DIR = path.join(__dirname, 'components');

if (!fs.existsSync(UPLOAD_DIR))
	fs.mkdirSync(UPLOAD_DIR);

// const limits = {
// 	fileSize: 1024 * 1024, // 1 MB (max file size)
// };

router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));

// router.get('/', (req, res, next) => {
// 	console.log(req.query);
// 	next();
// });

router.get('/index.html', (req, res) => res.redirect('/'));
router.use(express.static(path.join(__dirname, '../../../frontend/files')));

module.exports = { router, pool, UPLOAD_DIR, COMPONENTS_DIR };

router.use('/login', require('./routes/login'));
router.use('/files', require('./routes/files'));
router.use('/upload', require('./routes/upload'));
router.use('/download', require('./routes/download'));
router.use('/share', require('./routes/share'));