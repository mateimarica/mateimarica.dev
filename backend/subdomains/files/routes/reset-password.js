const express = require('express'),
      router = express.Router(),
      path = require('path'),
      fs = require('fs'),
      { redisClient, getTokenFromReq } = require('../authManager'),
      crypto = require('crypto'),
      { pool, COMPONENTS_DIR } = require('../files'),
      escape = require('escape-html'),
      emailValidator = require('email-validator'),
      mailWrapper = require('mail-wrapper'),
      { nanoid } = require('nanoid'),
      bcrypt = require('bcrypt');

require('@marko/compiler/register');

const RESET_PSWD_MAX_VALIDITY_SECS = Math.floor(process.env.FILES_RESET_PSWD_MAX_VALIDITY_MINS * 60);

const resetPasswordEmailTemplate = require(path.join(COMPONENTS_DIR, 'email', 'reset_password_email')).default;
router.post('/', async (req, res) => {
	const usernameOrEmail = req.body.usernameOrEmail;

	if (!usernameOrEmail || typeof usernameOrEmail !== 'string')
		return res.status(400).send('Must send a string for usernameOrEmail');

	const isEmail = emailValidator.validate(usernameOrEmail);
	const resBody = { isEmail: isEmail };
	if (!isEmail) { // if it's not a valid email, check its validity as a username
		const username = usernameOrEmail;                  // alphanumeric test v
		if (username.length < 2 || username.length > 15 || /^[a-z0-9]+$/i.test(username) === false) {
			return res.status(200).json(resBody); // just return vague 200, don't inform user if username/email exists
		}
	}

	const sql = `SELECT username, email FROM users WHERE ${ isEmail ? 'email' : 'username' }=?;`
	const params = [usernameOrEmail];

	pool.execute(sql, params, async (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length > 0) { // results will look like [{username: 'x', email: 'y@y.com'}] or [] for zero rows returned

			if (!results[0].email) {
				return res.status(400).send('That account doesn\'t have any email attached to it. Contact Matei.');
			}

			// URL parameter token
			const resetPswdAccessToken = nanoid(50);

			const data = {
				username: results[0].username,
				email: results[0].email
			}

			const accessTokenKey = `reset-password-access:${resetPswdAccessToken}`;
			const [setTokenReply] = await redisClient.set(
				accessTokenKey,
				JSON.stringify(data),
				{ 'EX': RESET_PSWD_MAX_VALIDITY_SECS }
			);

			if (setTokenReply === 0) {
				console.error('Failed to set reset-password access token in Redis.');
				return res.status(502).send('Something went wrong. Sound the alarms.');
			}

			const url = req.protocol + '://' + req.get('host') + '/reset-password?token=' + resetPswdAccessToken;

			const html = resetPasswordEmailTemplate.renderToString({
				username: escape(results[0].username),
				validityMins: Math.floor(RESET_PSWD_MAX_VALIDITY_SECS / 60),
				url: url
			});

			mailWrapper.send(results[0].email, 'Reset Password', html, async (err, info) => {
				if (err) {
					console.error('Failed to send reset-password email: ' + err);
					redisClient.del(accessTokenKey);
					return res.status(502).send('Something went wrong. Best tell Matei.');
				}

				return res.status(200).json(resBody); // just return vague 200, don't inform user if username/email exists
			});

		} else {
			return res.status(200).json(resBody); // just return vague 200, don't inform user if username/email exists
		}
	});
});

router.get('/', async (req, res) => {
	const accessToken = req.query.token;
	if (!accessToken) return res.sendStatus(400);

	const accessTokenDataJSON = await redisClient.get(`reset-password-access:${accessToken}`);
	if (accessTokenDataJSON === null) {
		return res.status(404).send('This link is either expired or never existed in this dimension.<br>Try resetting your password again.');
	}

	const resetPswdConfirmToken = crypto.randomBytes(60).toString('hex');
	const confirmTokenKey = `reset-password-confirm:${resetPswdConfirmToken}`;
	const [setConfirmTokenReply, delAccessTokenReply_UNUSED] = await redisClient
		.multi()
		.set(confirmTokenKey, accessTokenDataJSON, { 'EX': RESET_PSWD_MAX_VALIDITY_SECS })
		.del(`reset-password-access:${accessToken}`)
		.exec();

	if (setConfirmTokenReply === 0) {
		console.error('Failed to set reset-password confirm token in Redis.');
		return res.status(502).send('Something went wrong. Sound the alarms.');
	}

	res.cookie('resetPasswordConfirmToken', resetPswdConfirmToken, getConfirmTokenCookieOptions());
	res.sendFile(path.join(COMPONENTS_DIR, 'reset-password.html'));
});

router.patch('/', async (req, res) => {
	const token = getTokenFromReq(req, 'resetPasswordConfirmToken');
	if (!token) return res.status(400).send('Missing request cookie.');
	if (!req.body) return res.status(400).send('Missing request body.');
	const password = req.body.password;
	if (!password || typeof password !== 'string' || password.length < 6 || password.length > 200)
		return res.status(400).send('Password must be a string between 6 and 200 characters.');

	const confirmTokenKey = `reset-password-confirm:${token}`;
	const [getConfirmTokenReply, delConfirmTokenReply_UNUSED] = await redisClient
		.multi()
		.get(confirmTokenKey)
		.del(confirmTokenKey)
		.exec();

	if (!getConfirmTokenReply) return res.status(404).send('Invalid cookie. Sowwy. >_< uwu');

	bcrypt.hash(password, 10, (err, hash) => {
		if (err) {
			console.error(err);
			return res.sendStatus(500);
		}

		const data = JSON.parse(getConfirmTokenReply);
		const sql = `UPDATE users SET password=? WHERE username=?;`
		const params = [hash, data.username];

		pool.execute(sql, params, (err, results) => {
			if (err) {
				console.error(err);
				return res.sendStatus(502);
			}

			if (results && results.affectedRows === 1) {
				return res.sendStatus(204);
			}
		});
	});
});

router.delete('/', async (req, res) => {
	const token = getTokenFromReq(req, 'resetPasswordConfirmToken');
	if (!token) return res.sendStatus(404); // note: the browser might've already deleted the refreshToken cookie

	const [delConfirmTokenReply_UNUSED] = await redisClient.del(token);
	return res.sendStatus(204);
});

/** maxAge is in milliseconds */
function getConfirmTokenCookieOptions(maxAge=RESET_PSWD_MAX_VALIDITY_SECS*1000) {
	return {
		...maxAge !== null && {maxAge: maxAge},
		httpOnly: true, // http only, prevents JavaScript cookie access
		secure: true, // cookie must be sent over https / ssl
		sameSite: 'Strict',
		signed: true,
		path: '/reset-password'
	};
};

module.exports = router;