const express = require('express'),
      router = express.Router(),
      path = require('path'),
      multer  = require('multer'),
      fs = require('fs'),
	  poolManager = require('pool-manager'),
	  authManager = require('./authManager');

const pool = poolManager.getPool('files_db');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR))
	fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, UPLOAD_DIR);
	},
	filename: (req, file, cb) => {
		let filename = path.parse(file.originalname).name;
		let fileExt = path.parse(file.originalname).ext;
		let suffix = '';
		for (let i = 1; fs.existsSync(path.join(UPLOAD_DIR, filename + suffix + fileExt)); i++) {
			suffix = '(' + i + ')';
		}
		cb(null, filename + suffix + fileExt);
	}
});

const limits = {
	fileSize: 1024 * 1024, // 1 MB (max file size)
};

const upload = multer({ storage: storage });

router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));
router.use(express.static(path.join(__dirname, '../../../frontend/files')));

router.post('/login', (req, res) => {
	if (atob(req.get('Authorization')) === 'hello') {
		res.set('Authorization', authManager.createNewSession())
		res.sendStatus(200);
	} else {
		res.sendStatus(401);
	}
});

router.post('/upload', [authManager.authInspector, upload.array('files')], (req, res) => {
	// console.log(req.files);
	res.sendStatus(200); 
});

router.get('/files', (req, res) => {
	res.sendStatus(200); 
});

module.exports = router;