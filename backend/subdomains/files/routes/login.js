'use strict';

const express = require('express'),
      router = express.Router(),
      authManager = require('../authManager'),
      { pool, COMPONENTS_DIR } = require('../files'),
      path = require('path'),
      bcrypt = require('bcrypt'),
      rateLimit = require('express-rate-limit');

const FAILED_LOGIN_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_LOGIN_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_LOGIN_LIMITER_MAX_FAILED_REQUESTS,
	headers: false,
	skipSuccessfulRequests: true
});

const TOKEN_REFRESHER_RATE_LIMITER = rateLimit({
	windowMs: process.env.FILES_LOGIN_REFRESH_LIMITER_TIME_WINDOW_MINS * 60 * 1000,
	max: process.env.FILES_LOGIN_REFRESH_LIMITER_MAX_FAILED_REQUESTS,
	headers: false,
	skipSuccessfulRequests: true
});

router.post('/', FAILED_LOGIN_RATE_LIMITER, (req, res) => {
	if (!req.body) return res.sendStatus(400);

	const username = req.body.username;
	let password = req.body.password;
	delete req.body.password;

	if (!username || !password || typeof username !== 'string' || typeof password !== 'string')
		return res.sendStatus(400);

	if (username.length < 2 || username.length > 15 || /^[a-z0-9]+$/i.test(username) === false || password.length < 6 || password.length > 200)
		return res.sendStatus(401);

	const persistent = // is session is persistent or not
		req.body && req.body.persistentSession && typeof req.body.persistentSession === "boolean"
		? req.body.persistentSession
		: false;

	const sql = `SELECT username, password, role, active FROM users where username=?`,
	      params = [username];

	pool.execute(sql, params, (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length === 1) {
			const isActive = results[0].active;
			if (!isActive) return res.sendStatus(401);

			bcrypt.compare(password, results[0].password, async (err, isMatch) => {
				if (err) {
					console.log(err);
					return res.sendStatus(500);
				}

				if (!isMatch) return res.sendStatus(401);

				const tokens = await authManager.createSession(results[0].username, results[0].role, persistent);
				if (tokens === null) return res.sendStatus(502);

				if (persistent) {
					res.cookie('accessToken',  tokens.access,  authManager.getAccessTokenCookieOptions());
					res.cookie('refreshToken', tokens.refresh, authManager.getRefreshTokenCookieOptions());
				} else {
					res.set({
						'Access-Token':  tokens.access,
						'Refresh-Token': tokens.refresh
					});
				}

				res.status(200).sendFile(path.join(COMPONENTS_DIR, 'main.html'));
			});

			password = null; // null the password so we can't accidently do something with it

		} else {
			res.sendStatus(401);
		}
	});
});

router.get('/access', FAILED_LOGIN_RATE_LIMITER, async (req, res) => {
	const accessToken = authManager.getTokenFromReq(req, 'accessToken', 'Access-Token');

	if (accessToken && authManager.validateAccessToken(accessToken, authManager.ROLE.USER)) {
		return res.status(200).sendFile(path.join(COMPONENTS_DIR, 'main.html'));
	}

	return res.status(444).send("Invalid access token");
});

router.post('/refresh', TOKEN_REFRESHER_RATE_LIMITER, async (req, res) => {
	const refreshToken = authManager.getTokenFromReq(req, 'refreshToken', 'Refresh-Token');

	if (!refreshToken) return res.sendStatus(400);

	const oldSessionData = await authManager.invalidateRefreshToken(refreshToken);

	if (oldSessionData) { // Create new session using userdata from old session
		const tokens = await authManager.createSession(oldSessionData.username, oldSessionData.role, oldSessionData.persistent);
		if (tokens === null) return res.sendStatus(502);

		if (oldSessionData.persistent) {
			res.cookie('accessToken',  tokens.access,  authManager.getAccessTokenCookieOptions());
			res.cookie('refreshToken', tokens.refresh, authManager.getRefreshTokenCookieOptions());
		} else {
			res.set({
				'Access-Token':  tokens.access,
				'Refresh-Token': tokens.refresh
			});
		}

		res.sendStatus(200);
	} else {
		res.sendStatus(401);
	}
});

router.delete('/refresh', TOKEN_REFRESHER_RATE_LIMITER, async (req, res) => {
	const refreshToken = authManager.getTokenFromReq(req, 'refreshToken', 'Refresh-Token');

	if (!refreshToken) return res.sendStatus(401); // note: the browser might've already deleted the refreshToken cookie

	const userData = await authManager.invalidateRefreshToken(refreshToken);

	if (!userData) return 404;

	if (userData.persistent) {
		res.clearCookie('accessToken',  authManager.getAccessTokenCookieOptions(null));
		res.clearCookie('refreshToken', authManager.getRefreshTokenCookieOptions(null));
	} // If NOT persistent, the client will clear token vars

	res.sendStatus(204);
});

module.exports = router;