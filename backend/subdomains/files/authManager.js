const crypto = require('crypto');

let sessions = [];

const FILES_REMOVE_EXPIRED_SESSIONS_FREQ_MILLI = process.env.FILES_REMOVE_EXPIRED_SESSIONS_FREQ_MINS * 60 * 1000;
setInterval(removeExpiredSessions, FILES_REMOVE_EXPIRED_SESSIONS_FREQ_MILLI);

const ROLE = {
    ADMIN: 'admin',
    USER: 'user',
    INVITEE: 'invitee'
}

// admin can do anything, so calling authInspector() implies only admin can do the action
function authInspector(...permittedRoles) {
	return function (req, res, next) {
		let session = isSessionValid(req.get('Authorization'), permittedRoles);
		if (!session) {
			res.set('WWW-Authenticate', 'xBasic realm="files"');
			return res.sendStatus(401);
		}
		
		req.headers['Role'] = session.role;
		req.headers['Username'] = session.username;

		if (session.role === ROLE.INVITEE) {
			req.headers['MaxUploadSize'] = session.invite.maxUploadSize;
			req.headers['ExpirationDate'] = session.invite.expirationDate;
		} 
		
		next();
	}
}

/** Returns the authorization string */
function createNewSession(username, role, invite=undefined) {
	let newSession = {
		username: username,
		role: role,
		creationDate: new Date(),
		authorization: crypto.randomBytes(16).toString('hex'),
		invite: invite
	}

	sessions.push(newSession);

	return newSession.authorization;
}

const FILES_SESSION_VALIDITY_DURATION_MILLI = process.env.FILES_SESSION_VALIDITY_DURATION_MINS * 60 * 1000;

// Returns session if session valid. False if session invalid
function isSessionValid(authorization, permittedRoles) {
	if (!authorization) return false

	let currentDate = new Date();
	for (let i = sessions.length-1; i >= 0; i--) { // Count down for efficiency since new sessions are appended to sessions array
		if ((currentDate - sessions[i].creationDate) <= FILES_SESSION_VALIDITY_DURATION_MILLI) {
			if(sessions[i].authorization === authorization) {
				if (sessions[i].role === ROLE.ADMIN) {
					return sessions[i];
				} else {
					for (const permittedRole of permittedRoles) {
						if (sessions[i].role === permittedRole) {
							return sessions[i];
						}
					}
					return false;
				}
			} 
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

module.exports = { authInspector, createNewSession, ROLE }