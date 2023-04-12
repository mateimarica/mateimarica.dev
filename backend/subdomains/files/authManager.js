'use strict';

const crypto = require('crypto'),
      redis = require('redis');

const redisClient = redis.createClient({
	password: process.env.FILES_REDIS_PASSWORD
});
redisClient.on('error', async (err) => {
	console.error('Redis client error: ', err);
	await redisClient.disconnect(); // Force disconnect, otherwise redis client will keep attempting to connect, in a loop, forever
	console.error('Redis client forcefully disconnected.');
});
redisClient.on('ready', () => console.log('Redis client connected!'));
redisClient.connect();

const ROLE = {
	ADMIN: 'admin',
	USER: 'user',
	INVITEE: 'invitee'
};

/** admin can do anything, so calling authInspector() implies only admin can do the action */
function authInspector(...permittedRoles) {
	return async function (req, res, next) {
		const accessToken = getTokenFromReq(req, 'accessToken', 'Access-Token'), // try cookie first, then header
		      inviteAccessToken = req.header('Invite-Access-Token');

		if (!accessToken && !inviteAccessToken) {
			return res.status(444).send("Invalid access token");
		}
		
		// inviteAccessToken takes priority over accessToken
		const session = await validateAccessToken(inviteAccessToken ? inviteAccessToken : accessToken, permittedRoles);
		if (!session) {
			res.set('WWW-Authenticate', 'xBasic realm="files"');
			return res.status(444).send("Invalid access token"); // New funky code to mean "access token invalid"
		}
		
		req.headers['Role'] = session.role;
		req.headers['Username'] = session.username;

		if (session.role === ROLE.INVITEE) {
			req.headers['MaxUploadSize'] = session.maxUploadSize;
			req.headers['InviteId'] = session.inviteId;
			// unused for now
			//req.headers['ExpirationDate'] = session.invite.expirationDate;
		}
		
		next();
	}
}

const REFRESH_TOKEN_VALIDITY_SECS = Math.floor(process.env.FILES_REFRESH_TOKEN_VALIDITY_DAYS * 24 * 60 * 60),
      ACCESS_TOKEN_VALIDITY_SECS  = Math.floor(process.env.FILES_ACCESS_TOKEN_VALIDITY_HOURS      * 60 * 60);

/** pass undefined for 3rd param if no invite */
async function createSession(username, role, persistent=false) {
	const refreshToken = crypto.randomBytes(35).toString('hex');
	const accessToken  = crypto.randomBytes(20).toString('hex');
	const accessTokenData = {
		username: username,
		role: role,
		refreshToken: refreshToken, // Throw in access token so we can invalidate non-persistent session from just access token
		persistent: persistent
	};
	const refreshTokenData = {
		username: username,
		role: role,
		accessToken: accessToken, // Throw in access token so we can invalidate it when refreshing
		persistent: persistent
	};

	const [setRefreshReply, setAccessReply] = await redisClient
		.multi() // Start transaction
		.set(`refresh:${refreshToken}`, JSON.stringify(refreshTokenData), {'EX': REFRESH_TOKEN_VALIDITY_SECS})
		.set( `access:${accessToken}`,  JSON.stringify(accessTokenData),  {'EX': ACCESS_TOKEN_VALIDITY_SECS })
		.exec(); // End transaction

	if (setRefreshReply === 0 || setAccessReply === 0) return null; // Check responses. set() returns 0/1

	return {
		refresh: refreshToken,
		access: accessToken
	};
}

/** invites have no refresh token, just a single universal access token until invite expiration. Return true/false if successful */
async function createInviteSession(username, inviteId, maxAgeSecs, maxUploadSize) {
	const accessToken  = crypto.randomBytes(20).toString('hex');
	const accessTokenData = {
		role: ROLE.INVITEE,
		inviteId: inviteId,
		username: username,
		maxAgeSecs: maxAgeSecs,
		maxUploadSize: maxUploadSize,
	};
	const [setRefreshReply, setAccessReply] = await redisClient
		.multi() // Start transaction
		.set(`access:${accessToken}`, JSON.stringify(accessTokenData), {'EX': maxAgeSecs })
		.set( `invite:${inviteId}`,   accessToken,                     {'EX': maxAgeSecs })
		.exec(); // End transaction

	if (setAccessReply === 0) return false; // Check responses. set() returns 0/1

	return true;
}

// Returns session if access token valid. False if access token invalid
async function validateAccessToken(accessToken, permittedRoles) {
	
	const accessTokenDataJSON = await redisClient.get(`access:${accessToken}`);
	
	if (accessTokenDataJSON === null) {
		return false;
	}

	const accessTokenData = JSON.parse(accessTokenDataJSON);

	if (accessTokenData.role === ROLE.ADMIN) { // If they admin, let em through
		return accessTokenData;
		
	} else {
		for (const permittedRole of permittedRoles) { // Otherwise, check if their role is permitted
			if (accessTokenData.role === permittedRole) {
				return accessTokenData;
			}
		}
	}

	return false;
}

/** Returns some user data if sucessfully invalidated, false if not. False means it doesn't exist or has expired. */
async function invalidateRefreshToken(refreshToken) {
	const refreshTokenDataJSON = await redisClient.get(`refresh:${refreshToken}`); // Get refresh token
	
	if (refreshTokenDataJSON === null) return false;

	const refreshTokenData = JSON.parse(refreshTokenDataJSON);

	const [delRefreshReply, delAccessReply_UNUSED] = await redisClient
		.multi() // Start transaction
		.del(`refresh:${refreshToken}`)                // Delete refresh token
		.del(`access:${refreshTokenData.accessToken}`) // Delete access  token
		.exec(); // End transaction

	// If failed to delete refresh token, means it don't exist/expired. Return false.
	// If failed to delete access  token, it doesn't mean anything since it could be just expired.
	if (delRefreshReply === 0) return false;

	return {
		username: refreshTokenData.username,
		role: refreshTokenData.role,
		persistent: refreshTokenData.persistent
	};
}

const REFRESH_TOKEN_VALIDITY_MILLI = REFRESH_TOKEN_VALIDITY_SECS * 1000,
      ACCESS_TOKEN_VALIDITY_MILLI  = ACCESS_TOKEN_VALIDITY_SECS  * 1000;

function getAccessTokenCookieOptions(maxAge=ACCESS_TOKEN_VALIDITY_MILLI) {
	return {
		...maxAge !== null && {maxAge: maxAge},
		httpOnly: true, // http only, prevents JavaScript cookie access
		secure: true, // cookie must be sent over https / ssl
		sameSite: 'Strict',
		signed: true
	};
}

/** null maxAge means it wont get set */
function getRefreshTokenCookieOptions(maxAge=REFRESH_TOKEN_VALIDITY_MILLI) {
	return {
		...maxAge !== null && {maxAge: maxAge},
		httpOnly: true, // http only, prevents JavaScript cookie access
		secure: true, // cookie must be sent over https / ssl
		sameSite: 'Strict',
		signed: true,
		path: '/login/refresh'
	};
}

async function getInviteAccessToken(inviteId) {
	return await redisClient.get(`invite:${inviteId}`);
}

/** returns null if session not valid. returns true/false if session is valid depending on persistency */
async function getSessionData(accessToken) {
	const accessTokenDataJSON = await redisClient.get(`access:${accessToken}`); // Get refresh token data
	if (accessTokenDataJSON === null) return null;

	const accessTokenData = JSON.parse(accessTokenDataJSON);
	return accessTokenData;
}

function getTokenFromReq(req, cookieName, headerName=null) {
	return (req.signedCookies && req.signedCookies[cookieName]) || (headerName && req.header(headerName));
}

module.exports = { authInspector, createSession, ROLE, invalidateRefreshToken, getAccessTokenCookieOptions, getRefreshTokenCookieOptions, createInviteSession, getInviteAccessToken, getSessionData, validateAccessToken, getTokenFromReq, redisClient }