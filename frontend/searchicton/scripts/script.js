let passworded = false;
const TRANSITION_DURATION = 1400;

document.querySelector('#createLandmarkForm').addEventListener('submit', e => {
	e.preventDefault();

	const options = {
		headers: {
			'Content-Type': 'application/json', 
			'Authorization': document.querySelector('#createPasswordInput').value
		},
		body: JSON.stringify({
				title: document.querySelector('#titleInput').value,
				description: document.querySelector('#descInput').value,
				points: parseInt(document.querySelector('#pointsInput').value),
				category: document.querySelector('#categoryInput').value,
				longitude: parseFloat(document.querySelector('#longitudeInput').value),
				latitude: parseFloat(document.querySelector('#latitudeInput').value)
			})
	}

	sendHttpRequest('POST', '/landmarks', options, (http) => {
		let responseLabel = document.querySelector('#createResponseLabel');
		switch (http.status) {
			case 201:
				responseLabel.innerHTML = http.status + ' Created \u2713';
				document.querySelectorAll('#createLandmarkForm > .resetable').forEach(input => {
					input.value = "";
				});

				if (!passworded) {
					document.querySelectorAll('.passwordField').forEach(field => {
						field.disabled = true;
						field.value = document.querySelector('#createPasswordInput').value;
					});
					passworded = true;
				}
				break;
			default:
				responseLabel.innerHTML = http.status + ' ' + http.responseText;
		}
		responseChange(responseLabel);
	});
});

document.querySelector('#deleteLandmarkForm').addEventListener('submit', e => {
	e.preventDefault();

	const options = {
		headers: {
			'Content-Type': 'application/json', 
			'Authorization': document.querySelector('#deletePasswordInput').value
		},
		body: JSON.stringify({
				id: document.querySelector('#idInput').value
			})
	}

	sendHttpRequest('DELETE', '/landmarks', options, (http) => {
		let responseLabel = document.querySelector('#deleteResponseLabel');
		switch (http.status) {
			case 204:
				responseLabel.innerHTML = http.status + ' Deleted \u2713';

				document.querySelectorAll('#deleteLandmarkForm > .resetable').forEach(input => {
					input.value = "";
				});

				if (!passworded) {
					document.querySelectorAll('.passwordField').forEach(field => {
						field.disabled = true;
						field.value = document.querySelector('#deletePasswordInput').value;
					});
					passworded = true;
				}
				break;
			default:
				responseLabel.innerHTML = http.status + ' ' + http.responseText;
		}
		responseChange(responseLabel);
	});
});

document.querySelector('#pasteBtn').addEventListener('click', async () => {
	const text = await navigator.clipboard.readText();
	const longLat = text.match(/[^, ]+/g);

	document.querySelector('#longitudeInput').value = longLat[0];
	document.querySelector('#latitudeInput').value = longLat[1];
});

async function responseChange(responseLabel) {
	responseLabel.classList.add('newResponse');
	await sleep(750);
	responseLabel.classList.remove('newResponse');
}

/** {headers: {'Content-Type': 'application/json', 'Header1':'value'}, responseType: 'type', body: 'some body'} */
function sendHttpRequest(method, url, options, callback) {
	const http = new XMLHttpRequest();
	http.addEventListener('load', (e) => callback(http, e)); // If ready state is 4, do async callback

	if (options.uploadOnProgress)
		http.upload.onprogress = options.uploadOnProgress;

	http.open(method, url, async=true);

	if (options.headers)
		for (let key in options.headers) {
			http.setRequestHeader(key, options.headers[key]);
		}

	if (options.responseType)
		http.responseType = options.responseType;

	http.send(options.body ?? null);
}

function sleep(milli) {
	return new Promise(resolve => {
		setTimeout(() => { resolve() }, milli);
	});
}