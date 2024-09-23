'use strict';

const { nanoid } = require('nanoid');

/**
Object storing polls created by users. The poll objects are compartmentalized by username for efficiency
@example
{
	"matei": {
		// this could be a session on a phone
		"1234567": { // the key is the pollerId
			req: Request,
			res: Response,
			timeCreated: Date
		},
		// this could be a session on a pc
		"abcdefg": {
			req: Request,
			res: Response,
			timeCreated: Date
		}
	},
	"john": {
		// john only signed in on his phone, so only one session
		"56789ab": {
			req: Request,
			res: Response,
			timeCreated: Date
		}
	},
	"jane": {} // jane signed in earlier but her polling session was deleted due to inactivity by cleanupPollers()
}
*/
const userPollers = {}; // all the USER requests waiting for a response

/**
Object storing polls created by non-logged-in users. The poll objects are laid flat in the root object.
A pollerId must exist in this object prior to the client making a poll. This way, randos can't make polls
@example
{
	"1234567": { // the key is the pollerId
		req: Request,
		res: Response,
		timeCreated: Date
	},
	"abcdefg": {
		req: Request,
		res: Response,
		timeCreated: Date
	},
	"56789ab": {
		req: Request,
		res: Response,
		timeCreated: Date
	},
	"49t34tg": null // valid but empty
}
*/
const anonPollers = {}; // all the USER requests waiting for a response

function createPoll(req, res) {
	const pollerId = req.body.pollerId;
	if (!pollerId || typeof pollerId !== 'string' || pollerId.length !== 7)
		return res.sendStatus(400);

	const lastDataIdClient = req.body.lastDataId;
	if (lastDataIdClient && (typeof lastDataIdClient !== 'string'))
		return res.sendStatus(400);

	const username = req.headers['Username'];
	const isUser = !!username;
	res.setHeader('Content-Type', 'application/json');

	if (isUser) { // if user
		// create object for user if not exist
		if (!userPollers[username]) {
			userPollers[username] = {};
		// if pollerId entry already exists, return response if lastData exists
		} else if (userPollers[username][pollerId]) {

			const lastDataId = userPollers[username][pollerId].lastDataId;
			if (lastDataIdClient !== lastDataId) {
				res.json(userPollers[username][pollerId].lastData);
				delete userPollers[username][pollerId];
				return;
			}

		}

		// insert this poll
		userPollers[username][pollerId] = {
			req: req,
			res: res,
			timeCreated: new Date()
		};
	} else { //if anon
		// the pollerId must already be registered for it to be useable
		if (!(pollerId in anonPollers)) {
			return res.sendStatus(400);
		}

		// check if this pollerId has data waiting for them
		if (anonPollers[pollerId] !== null) {
			const lastDataId = anonPollers[pollerId].lastDataId;
			if (lastDataIdClient !== lastDataId) {
				res.json(anonPollers[pollerId].lastData);
				anonPollers[pollerId] = null;
				return;
			}
		}

		// insert this poll
		anonPollers[pollerId] = {
			req: req,
			res: res,
			timeCreated: new Date()
		};
	}
}

/** Returns the updated notes to all the polling sessions for a specific user (but not the session that triggered the change)
@param username The username of the user that edited a note
@param pollerIdIn The 7-character poller ID passed in by the user
@param data An object containing data to be sent to the other pollers

*/
async function syncUserPollers(username, pollerIdIn, data) {
	// make a shallow copy so that this operation is atomic
	// we don't want the userPollers array to change while we're iterating through it
	const sessions = userPollers[username];
	if (!sessions) return; // return if that user has no sessions. This shouldn't happen but a malicious fella with postman could cause this
	const lastDataId = nanoid(12);
	const pollerIds = Object.keys(sessions);
	const len = pollerIds.length;
	for (let i = 0; i < len; i++) {
		const pollerId = pollerIds[i];
		if (pollerId === pollerIdIn) continue;
		const session = sessions[pollerId];

		userPollers[username][pollerId].lastData = {...userPollers[username][pollerId].lastData, ...data}; // merge objects. if duplicate keys, 2nd obj keys overwrites 1st obj keys;
		userPollers[username][pollerId].lastDataId = lastDataId;

		if (session.req._readableState.errored || session.res.writableEnded) continue; // if the request errored (eg: timed out) or response already sent
		session.res.json(Object.assign(data, { lastDataId: lastDataId }));
	}
}

async function syncAnonPoller(pollerIdIn, data) {
	if (!(pollerIdIn in anonPollers)) return;
	const session = anonPollers[pollerIdIn];
	if (!session) return;

	const lastDataId = nanoid(12);
	anonPollers[pollerIdIn].lastData = {...anonPollers[pollerIdIn].lastData, ...data}; // merge objects. if duplicate keys, 2nd obj keys overwrites 1st obj keys
	anonPollers[pollerIdIn].lastDataId = lastDataId;
	if (session.req._readableState.errored || session.res.writableEnded) return; // if the request errored (eg: timed out) or response already sent
	session.res.json(Object.assign(data, { lastDataId: lastDataId }));
}

const cleanupPollersIntervalMilli = process.env.FILES_NOTES_POLLER_CLEANUP_INTERVAL_MINS * 60 * 1000,
      requestTimeoutMilli = process.env.REQUEST_TIMEOUT_MINS * 60 * 1000;
async function cleanupPollers() {
	cleanupUserPollers();
	cleanupAnonPollers();
}

function cleanupUserPollers() {
	const userPollersCopy = userPollers;
	const usernames = Object.keys(userPollersCopy); // this is an array of usernames -> ["matei", "john", "jane", ...]
	const usernamesLen = usernames.length;
	const currentDate = new Date();
	for (let i = 0; i < usernamesLen; i++) {
		const username = usernames[i];
		const sessions = userPollersCopy[username]; // This is an object of session objects -> {pollerId:{...},pollerId:{...},pollerId:{...}}
		const pollerIds = Object.keys(sessions); // array of pollerIds -> ["1234567", "abcdefg", ...]
		const sessionsLen = pollerIds.length;
		for (let j = 0; j < sessionsLen; j++) {
			const pollerId = pollerIds[j];
			const session = sessions[pollerId];
			if (currentDate - session.timeCreated > requestTimeoutMilli) {
				delete userPollers[username][pollerId];
				if (session.req._readableState.errored || session.res.writableEnded) continue;
				session.res.status(408).send(); // 408 timeout
			}
		}
	}
}

function cleanupAnonPollers() {
	const anonPollersCopy = anonPollers; // This is an object of session objects -> {pollerId:{...},pollerId:{...},pollerId:{...}}
	const pollerIds = Object.keys(anonPollersCopy); // array of pollerIds -> ["1234567", "abcdefg", ...]
	const sessionsLen = pollerIds.length;
	const currentDate = new Date();

	for (let j = 0; j < sessionsLen; j++) {
		const pollerId = pollerIds[j];
		const session = anonPollersCopy[pollerId];
		if (currentDate - session.timeCreated > requestTimeoutMilli) {
			delete anonPollers[pollerId];
			if (session.req._readableState.errored || session.res.writableEnded) continue;
			session.res.status(408).send(); // 408 timeout
		}
	}
}

setInterval(cleanupPollers, cleanupPollersIntervalMilli)

module.exports = { createPoll, syncUserPollers, syncAnonPoller }