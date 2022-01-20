const express = require('express'),
      router = express.Router(),
      path = require('path'),
      multer  = require('multer'),
      fs = require('fs'),
      authManager = require('../authManager'),
      sizeVerifier = require('../sizeVerifier'),
	  files = require('../files');

const pool = files.pool;
const UPLOAD_DIR = files.UPLOAD_DIR;

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

const upload = multer({ storage: storage });

router.post('/', [authManager.authInspector, sizeVerifier.sizeVerifier, upload.array('files')], (req, res) => {
	const FILES = req.files;

	if (FILES.length === 0)
		return res.status(400).send('No files recieved');

	let sql = `INSERT INTO files (baseName, name, ext, size, path, uploader) VALUES `;
	let params = [];

	for (let i = 0; i < FILES.length; i++) {
		sql += (i === FILES.length-1 ? `(?,?,?,?,?,?)` : `(?,?,?,?,?,?),`);
		let file = path.parse(FILES[i].filename);
		params = params.concat([file.base, file.name, file.ext, FILES[i].size, FILES[i].path], req.headers['Username']);
	}

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
		res.status(200).send(results); 
	});
});

module.exports = router;