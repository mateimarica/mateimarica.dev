import { displayToast } from './toasts.mjs';

let accessToken = null,
    refreshToken = null,
    inviteAccessToken = null,
    loggedIn = false; // general boolean for being logged info, regardless of persistency of session

/** {headers: {'Content-Type': 'application/json', 'Header1':'value'}, responseType: 'type', body: 'some data'} */
function sendHttpRequest(method, url, options, callbacks) {
	const http = new XMLHttpRequest();

	for (const event in callbacks) {
		if (event === 'load') continue; // use the load event listener below instead
		if (event === 'progress') {
			http.upload.onprogress = callbacks[event]; // progress events are fired on xhr.upload
			continue;
		}
		http.addEventListener(event, callbacks[event]);
	}

	http.addEventListener('load', async (e) => { // If ready state is 4, do async callback
		if (http.status === 444) { // 444 means access token invalid, so we try refresh token
			if (inviteAccessToken) { // if this is an invite session, nothing else we can do. log 'em out
				window.location.search = '&signout=server';
			}

			let refreshOptions = {};
			if (refreshToken) {
				refreshOptions = {headers: {'Refresh-Token': refreshToken}};
			}
			
			sendHttpRequest('POST', '/login/refresh', refreshOptions, { load: (http2) => {
				switch (http2.status) {
					case 200:
						if (refreshToken) {
							accessToken  = http2.getResponseHeader("Access-Token");
							refreshToken = http2.getResponseHeader("Refresh-Token");
						}
						sendHttpRequest(method, url, options, callbacks);
						return;
					default:
						accessToken = null, refreshToken = null;
						if (loggedIn) {
							document.querySelector('#app').remove(); // delete the app div so sensitive info is not visible
							setTimeout(() => { // 10 milli delay so DOM can update before native alert freezes everything
								window.location.search = '&signout=server';
							}, 10);
						} else {
							callbacks.load(http2, e);
						}
				}
			}});
		} else {
			callbacks.load(http, e);
		}
	});

	http.open(method, url, true);

	if (options.headers)
		for (let key in options.headers) {
			http.setRequestHeader(key, options.headers[key]);
		}

	// If session not persistent, add access token
	if (accessToken) {
		http.setRequestHeader("Access-Token", accessToken);
	} else if (inviteAccessToken) {
		http.setRequestHeader("Invite-Access-Token", inviteAccessToken);
	}

	if (options.responseType)
		http.responseType = options.responseType;

	http.send(options.body || null);
}

function logout() {
	let options = {};
	if (refreshToken) {
		options = {headers: {'Refresh-Token': refreshToken}};
	}
	sendHttpRequest('DELETE', '/login/refresh', options, { load: (http) => {
		accessToken = null, refreshToken = null;
		switch (http.status) {
			case 204:
				window.location.search = '&signout=user';
				break;
			case 401: // log out even if session not valid
				window.location.search = '&signout=user_expired';
				break;
			case 500:
			case 502:
				displayToast('Server error. Try again later.');
				break;
			default:
				displayToast('Something went wrong. Status code: ' + http.status);
		}
	}});
}

function setAccessToken(value) { accessToken = value; }

function setRefreshToken(value) { refreshToken = value; }

function setInviteAccessToken(value) { inviteAccessToken = value; }

function setLoggedIn() { loggedIn = true; }

function isInviteSession() { return !!inviteAccessToken }

export { 
	sendHttpRequest,
	setAccessToken,
	setRefreshToken,
	setInviteAccessToken,
	setLoggedIn,
	isInviteSession,
	logout
};