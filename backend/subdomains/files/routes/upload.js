const express = require('express'),
      router = express.Router(),
      path = require('path'),
      multer  = require('multer'),
      fs = require('fs'),
      {authInspector, ROLE} = require('../authManager'),
      sizeVerifier = require('../sizeVerifier').sizeVerifier,
	  files = require('../files');

const pool = files.pool;
const UPLOAD_DIR = files.UPLOAD_DIR;

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		let role = req.headers['Role'];
		let destinationDir = path.join(UPLOAD_DIR, role === ROLE.INVITEE ? 'invited' : 'users', req.headers['Username']);
		fs.mkdirSync(destinationDir, { recursive: true }); // Recursive means create parent dirs if not exist. eg: create "upload" folder
		cb(null, destinationDir);
	},
	filename: (req, file, cb) => {
		let filename = path.parse(file.originalname).name;
		let fileExt = path.parse(file.originalname).ext;
		let suffix = '';
		let role = req.headers['Role'];
		let destinationDir = path.join(UPLOAD_DIR, role === ROLE.INVITEE ? 'invited' : 'users', req.headers['Username']);
		for (let i = 1; fs.existsSync(path.join(destinationDir, filename + suffix + fileExt)); i++) {
			suffix = '(' + i + ')';
		}
		cb(null, filename + suffix + fileExt);
	}
});

const upload = multer({ storage: storage });

router.post('/', [authInspector(ROLE.USER, ROLE.INVITEE), sizeVerifier, upload.array('files')], (req, res) => {
	const FILES = req.files;

	if (FILES.length === 0)
		return res.status(400).send('No files received');

	const isInvitee = (req.headers['Role'] === ROLE.INVITEE);

	if (isInvitee) {
		var sql = `INSERT INTO files (baseName, name, ext, size, path, uploader, isInvited) VALUES `;
		var values = `(?,?,?,?,?,?,?)`;
	} else {
		var sql = `INSERT INTO files (baseName, name, ext, size, path, uploader) VALUES `;
		var values = `(?,?,?,?,?,?)`;
	}

	let params = [];

	for (let i = 0; i < FILES.length; i++) {
		sql += (i === FILES.length-1 ? values : values + ',');
		let file = path.parse(FILES[i].filename);
		if (isInvitee) {
			params = params.concat(file.base, file.name, file.ext, FILES[i].size, FILES[i].path, req.headers['Username'], true);
		} else {
			params = params.concat(file.base, file.name, file.ext, FILES[i].size, FILES[i].path, req.headers['Username']);
		}
		
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