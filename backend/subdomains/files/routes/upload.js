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
		//let role = req.headers['Role']; // unused
		const destinationDir = path.join(UPLOAD_DIR, req.headers['Username']);
		fs.mkdirSync(destinationDir, { recursive: true }); // Recursive means create parent dirs if not exist. eg: create "uploads" folder
		cb(null, destinationDir);
	},
	filename: (req, file, cb) => {
		const filename = path.parse(file.originalname).name
			.replace(/(\s+)?\([0-9]+\)$/, ''); // remove duplicate file numbering. Eg: "file.txt (5)" -> "file.txt"
		const fileExt = path.parse(file.originalname).ext;
		let suffix = '';
		//let role = req.headers['Role']; // unused
		const destinationDir = path.join(UPLOAD_DIR, req.headers['Username']);
		for (let i = 1; fs.existsSync(path.join(destinationDir, filename + suffix + fileExt)); i++) {
			suffix = ' (' + i + ')';
		}
		const fullFileName =  filename + suffix + fileExt

		// Pre-save a file so that other files in this upload can adjust filename based on this.
		// Eg: "1.js" already exists and you upload "1.js" and "1 (1).js"
		// Without this, it would try to insert "1 (1).js" and "1 (1).js" into the database, causing an ER_DUP_ENTRY error.
		// We do this sync to avoid any race conditions.
		try {
			fs.openSync(path.join(destinationDir, fullFileName), 'w');
		} catch (err) {
			console.log(`Failed to pre-save ${path.join(destinationDir, fullFileName)}: ${err}`);
			throw err;
		}
		
		cb(null, fullFileName);

		// Register this listener to delete a file if it's aborted before it's done uploading
		// Thanks to this homie https://github.com/expressjs/multer/issues/259#issuecomment-691748926
		req.on('aborted', () => {
			const fullFilePath = path.join(destinationDir, fullFileName);
			file.stream.on('end', () => {
				fs.unlink(fullFilePath, (err) => {
					if (err) console.error(err);
				});
			});
			file.stream.emit('end');
		});
	}
});

const UPLOAD_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_SIGNUP_REVIEWAL_TIME_WINDOW_MILLI,
	max: process.env.FILES_UPLOAD_LIMITER_MAX_REQUESTS,
	message: 'Slow down with the uploads, homie. Try again.',
	headers: false
});

const upload = multer({ storage: storage });

router.post('/', [UPLOAD_RATE_LIMITER, authInspector(ROLE.USER, ROLE.INVITEE), sizeVerifier, upload.array('files')], (req, res) => {
	const FILES = req.files;

	if (FILES.length === 0)
		return res.status(400).send('No files received');

	const isInvitee = (req.headers['Role'] === ROLE.INVITEE);

	if (isInvitee) {
		var sql = `INSERT INTO files (baseName, name, ext, size, path, uploader, inviteId) VALUES `;
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
			params = params.concat(file.base, file.name, file.ext, FILES[i].size, FILES[i].path, req.headers['Username'], req.headers['InviteId']);
		} else {
			params = params.concat(file.base, file.name, file.ext, FILES[i].size, FILES[i].path, req.headers['Username']);
		}
	}

	pool.execute(sql, params, (err, results) => {
		if (err) {
			res.sendStatus(502);
			console.log(err);
			
			// Delete the files that were just uploaded because the INSERT failed
			for (let i = 0; i < FILES.length; i++) {
				fs.unlink(FILES[i].path, (err) => {
					if (err) console.error(err);
				});
			}
			return;
		}

		res.status(200).send(results); 
	});

});

module.exports = router;