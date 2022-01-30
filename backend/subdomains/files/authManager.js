const crypto = require('crypto');

let sessions = [];

const FILES_REMOVE_EXPIRED_SESSIONS_FREQ_MILLI = process.env.FILES_REMOVE_EXPIRED_SESSIONS_FREQ_MINS * 60 * 1000;
setInterval(removeExpiredSessions, FILES_REMOVE_EXPIRED_SESSIONS_FREQ_MILLI);

function authInspector(req, res, next) {
	let username = isSessionValid(req.get('Authorization'));
	if (!username) {
		res.set('WWW-Authenticate', 'xBasic realm="files"');
		return res.sendStatus(401);
	}

	req.headers['Username'] = username;
	next();
}

/** Returns the authorization string */
function createNewSession(username) {
	let newSession = {
		username: username,
		creationDate: new Date(),
		authorization: crypto.randomBytes(16).toString('hex')
	}

	sessions.push(newSession);

	return newSession.authorization;
}

const FILES_SESSION_VALIDITY_DURATION_MILLI = process.env.FILES_SESSION_VALIDITY_DURATION_MINS * 60 * 1000;

function isSessionValid(authorization) {
	if (!authorization) return false

	let currentDate = new Date();
	for (let i = sessions.length-1; i >= 0; i--) { // Count down since new sessions are appended to sessions array
		if ((currentDate - sessions[i].creationDate) <= FILES_SESSION_VALIDITY_DURATION_MILLI) {
			if(sessions[i].authorization === authorization) return sessions[i].username;
		} else {
			if(sessions[i].authorization === authorization) {
				sessions.splice(i, 1); // removes 1 element starting at index i
				return false;
			} 
		}
	}
	
	return false;
}

function removeExpiredSessions() {
	let currentDate = new Date();
	for (let i = 0; i < sessions.length; i++) {
		if ((currentDate - sessions[i].creationDate) > 4000) {
			sessions.splice(i, 1); // removes 1 element starting at index i
		} 
	}
}

module.exports = { authInspector, createNewSession }