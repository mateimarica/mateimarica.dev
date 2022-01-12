const express = require('express'),
      router = express.Router(),
      path = require('path'),
      multer  = require('multer'),
      fs = require('fs'),
      poolManager = require('pool-manager'),
      authManager = require('./authManager'),
      { atob } = require('buffer');

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

// const limits = {
// 	fileSize: 1024 * 1024, // 1 MB (max file size)
// };

const upload = multer({ storage: storage });

router.use(express.json({limit: process.env.REQUEST_MAX_BODY_SIZE}));
router.use(express.urlencoded({limit: process.env.REQUEST_MAX_BODY_SIZE, extended: true}));

// router.get('/', (req, res, next) => {
// 	console.log(req.query);
// 	next();
// });

router.get('/index.html', (req, res) => res.redirect('/'));

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
	
	const FILES = req.files;
	let sql = `INSERT INTO files (baseName, name, ext, size, path) VALUES `;
	let params = [];

	for (let i = 0; i < FILES.length; i++) {
		sql += (i === FILES.length-1 ? `(?,?,?,?,?)` : `(?,?,?,?,?),`);
		let file = path.parse(FILES[i].filename);
		params = params.concat([file.base, file.name, file.ext, FILES[i].size, FILES[i].path]);
	}

	pool.execute(sql, params, (err) => {
		if (err) {
			console.log(err);
			return res.sendStatus(500);
		}
		res.sendStatus(200); 
	});
});

const FILES_MAX_STORAGE_BYTES = process.env.FILES_MAX_STORAGE_GBS * 1000000000;
router.get('/files', authManager.authInspector, (req, res) => {

	pool.execute(`SELECT baseName, name, ext, size, uploadDate, uploader FROM files ORDER BY uploadDate DESC`, (err1, results1) => {
		if (err1) {
			console.log(err1);
			return res.sendStatus(500);
		}

		pool.execute(`SELECT COALESCE(CONVERT(SUM(size), SIGNED), 0) AS usedSpace FROM files`, (err2, results2) => {
			if (err2) {
				console.log(err2);
				return res.sendStatus(500);
			}

			res.status(200).send({
				usedSpace: results2[0].usedSpace,
				totalSpace: FILES_MAX_STORAGE_BYTES,
				files: results1
			});

		});
	});
});

router.get('/download',  (req, res) => {
	if (!req.query.name)
		return res.sendStatus(400);

	const fileURL = path.join(__dirname, 'uploads', atob(req.query.name));
	
	if (!fs.existsSync(fileURL))
		return res.sendStatus(404);

	res.download(fileURL);
});

module.exports = router;