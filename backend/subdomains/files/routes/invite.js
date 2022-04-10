const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      {authInspector, createNewSession, ROLE} = require('../authManager'),
	  enoughSpace = require('../sizeVerifier').enoughSpace
      crypto = require('crypto'),
      templateEngine = require('template-engine'),
      files = require('../files');

const UPLOAD_DIR = files.UPLOAD_DIR;
const pool = files.pool;
	  
router.post('/', authInspector(), (req, res) => {
	const invitee = req.body.name,
	      message = req.body.message,
	      maxUploadSize = req.body.maxUploadSize,
	      validity = req.body.validity; // validity is in hours

	enoughSpace(maxUploadSize, enoughSpaceExists => {
		if (!invitee || invitee.length > 50 ||
			(message && message.length > 255) || // Message can be blank string
			!maxUploadSize || !Number.isInteger(maxUploadSize) || maxUploadSize <= 0 || !enoughSpaceExists || 
			!validity || isNaN(validity) || validity <= 0 || validity > 9999) {
			return res.sendStatus(400);
		}
	
		const id = crypto.randomBytes(2).toString('hex');
	
		const sql = `INSERT INTO invites (id, inviteeName, message, expirationDate, maxUploadSize, inviter) ` +
					`VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE), ?, ?)`,
			  params = [id, invitee, message, validity * 60, maxUploadSize, req.headers['Username']];
	
		pool.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(502);
			}
	
			if (results && results.affectedRows === 1) {
				const url = req.protocol + '://' + req.get('host') + '/?invite=' + id;
	
				return res.status(201).send({url: url});
			} else {
				return res.sendStatus(409);
			}
		});
	});
	
});

router.get('/', (req, res) => {
	const id = req.query.id;

	if (!id)
		return res.sendStatus(400);


	const sql = `SELECT id, inviteeName, message, expirationDate, maxUploadSize FROM invites WHERE id=?`,
	      params = [id];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}
		
		if (results && results.length === 1) {
			const currentDate = new Date(),
			      expirationDate = new Date(results[0].expirationDate);
			
			if (currentDate > expirationDate)
				return res.sendStatus(404);

			res.set('Authorization', createNewSession(results[0].id, ROLE.INVITEE, {
				inviteeName: results[0].inviteeName,
				expirationDate: results[0].expirationDate,
				maxUploadSize: results[0].maxUploadSize
			}));
			const html = templateEngine.fillHTML(
				path.join(__dirname, '..', 'components', 'invite.html'),
				{
					name: results[0].inviteeName,
					message: results[0].message
				}
			)
			res.status(200).send(html);
		} else {
			return res.sendStatus(404);
		}
	});

	
});



module.exports = router;