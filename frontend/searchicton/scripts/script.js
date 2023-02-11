const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

let passworded = false;
const TRANSITION_DURATION = 1400;

$('#createLandmarkForm').addEventListener('submit', e => {
	e.preventDefault();

	const options = {
		headers: {
			'Content-Type': 'application/json', 
			'Authorization': $('#createPasswordInput').value
		},
		body: JSON.stringify({
				title: $('#titleInput').value,
				description: $('#descInput').value,
				points: parseInt($('#pointsInput').value),
				category: $('#categoryInput').value,
				longitude: parseFloat($('#longitudeInput').value),
				latitude: parseFloat($('#latitudeInput').value)
		})
	}

	sendHttpRequest('POST', '/landmarks', options, (http) => {
		let responseLabel = $('#createResponseLabel');
		switch (http.status) {
			case 201:
				responseLabel.textContent = http.status + ' Created \u2713';
				$$('#createLandmarkForm > .resetable').forEach(input => {
					input.value = "";
				});

				if (!passworded) {
					$$('.passwordField').forEach(field => {
						field.disabled = true;
						field.value = $('#createPasswordInput').value;
					});
					passworded = true;
				}
				break;
			default:
				responseLabel.textContent = http.status + ' ' + http.responseText;
		}
		responseChange(responseLabel);
	});
});

$('#deleteLandmarkForm').addEventListener('submit', e => {
	e.preventDefault();

	const options = {
		headers: {
			'Content-Type': 'application/json', 
			'Authorization': $('#deletePasswordInput').value
		},
		body: JSON.stringify({
				id: parseInt($('#idInput').value)
			})
	}

	sendHttpRequest('DELETE', '/landmarks', options, (http) => {
		let responseLabel = $('#deleteResponseLabel');
		switch (http.status) {
			case 204:
				responseLabel.textContent = http.status + ' Deleted \u2713';

				$$('#deleteLandmarkForm > .resetable').forEach(input => {
					input.value = "";
				});

				if (!passworded) {
					$$('.passwordField').forEach(field => {
						field.disabled = true;
						field.value = $('#deletePasswordInput').value;
					});
					passworded = true;
				}
				break;
			default:
				responseLabel.textContent = http.status + ' ' + http.responseText;
		}
		responseChange(responseLabel);
	});
});

$('#pasteBtn').addEventListener('click', async () => {
	const text = await navigator.clipboard.readText();
	const longLat = text.match(/[^, ]+/g);

	$('#latitudeInput').value = longLat[0];
	$('#longitudeInput').value = longLat[1];
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