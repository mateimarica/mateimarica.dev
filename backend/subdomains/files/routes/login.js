const express = require('express'),
      router = express.Router(),
      authManager = require('../authManager'),
      files = require('../files'),
      path = require('path'),
      { atob } = require('buffer'),
      rateLimit = require('express-rate-limit');

const pool = files.pool;

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
	const username = req.get('Username'),
	      password = atob(req.get('Authorization'));

	if (!username || (!password && password !== '')) {
		return res.sendStatus(400);
	}
	
	const persistent = // is session is persistent or not
		req.body && req.body.persistentSession && typeof req.body.persistentSession === "boolean" 
		? req.body.persistentSession
		: false;

	const sql = `SELECT username, role FROM users where username=? AND password=SHA1(?)`,
	      params = [username, password];

	pool.execute({sql: sql}, params, async (err, results) => {
		if (err) {
			console.log(err);
			return res.sendStatus(502);
		}

		if (results && results.length === 1) {
			const tokens = await authManager.createSession(username, results[0].role, persistent);
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

			res.status(200).sendFile(path.join(files.COMPONENTS_DIR, 'main.html'));
		} else {
			res.sendStatus(401);	
		}
	});
});

router.get('/access', FAILED_LOGIN_RATE_LIMITER, async (req, res) => {
	const accessToken = authManager.getTokenFromReq(req, 'accessToken', 'Access-Token');
	
	if (accessToken && authManager.validateAccessToken(accessToken, authManager.ROLE.USER)) {
		return res.status(200).sendFile(path.join(files.COMPONENTS_DIR, 'main.html'));
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

	if (!refreshToken) return res.sendStatus(400);

	const userData = await authManager.invalidateRefreshToken(refreshToken);

	if (!userData) return 404;

	if (userData.persistent) {
		res.clearCookie('accessToken',  authManager.getAccessTokenCookieOptions(null));
		res.clearCookie('refreshToken', authManager.getRefreshTokenCookieOptions(null));
	} // If NOT persistent, the client will clear token vars
	
	res.sendStatus(204);
});

module.exports = router;