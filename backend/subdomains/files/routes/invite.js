'use strict';

const express = require('express'),
      router = express.Router(),
      path = require('path'),
      { authInspector, ROLE, createInviteSession, getInviteAccessToken } = require('../authManager'),
      enoughSpace = require('../sizeVerifier').enoughSpace,
      { pool, COMPONENTS_DIR } = require('../files'),
      escape = require('escape-html'),
      { nanoid } = require('nanoid');

require('@marko/compiler/register');

router.post('/', authInspector(ROLE.USER), async (req, res) => {
	const invitee = req.body.name,
	      message = req.body.message,
	      maxUploadSize = req.body.maxUploadSize,
	      validity = req.body.validity; // validity is in hours

	if (!invitee || invitee.length > 50 ||
		(message && message.length > 255) || // Message can be blank string
		!maxUploadSize || !Number.isInteger(maxUploadSize) || maxUploadSize <= 0 ||
		!validity || isNaN(validity) || validity <= 0 || validity > 9999) {
		return res.sendStatus(400);
	}

	enoughSpace(maxUploadSize, req.headers['Username'], res, async (isEnoughSpace) => {
		if (!isEnoughSpace) return;

		const id = nanoid(7);
		const validitySeconds = Math.floor(validity * 3600);

		if (!await createInviteSession(req.headers['Username'], id, validitySeconds, maxUploadSize)) // Turns hours to seconds
			return res.sendStatus(502);

		const sql = `INSERT INTO invites (id, inviteeName, message, expirationDate, maxUploadSize, inviter) ` +
					`VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE), ?, ?)`,
			  params = [id, invitee, message, validity * 60, maxUploadSize, req.headers['Username']];

		pool.execute(sql, params, (err, results) => {
			if (err) {
				console.log(err);
				return res.sendStatus(502);
			}

			if (results && results.affectedRows === 1) {
				const url = req.protocol + '://f.mateimarica.dev/?invite=' + id;
				return res.status(201).send({url: url});
			} else {
				return res.sendStatus(409);
			}
		});
	});
});

const inviteTemplate = require(path.join(COMPONENTS_DIR, 'invite')).default;
router.get('/', async (req, res) => {
	const id = req.query.id;

	if (!id) return res.sendStatus(400);

	const inviteAccessToken = await getInviteAccessToken(id);
	if (!inviteAccessToken) return res.sendStatus(404);

	const sql = `SELECT id, inviteeName, message, expirationDate, maxUploadSize FROM invites WHERE BINARY id=?`,
	      params = [id];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length === 1) {
			res.set('Invite-Access-Token', inviteAccessToken);

			const html = inviteTemplate.renderToString({
				name: escape(results[0].inviteeName), // escape to prevent HTML injection :)
				message: escape(results[0].message)
			});

			res.status(200).send(html);
		} else {
			return res.sendStatus(404);
		}
	});


});

module.exports = router;