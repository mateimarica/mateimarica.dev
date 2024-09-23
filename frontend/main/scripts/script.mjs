'use strict';

import { displayToast } from 'https://files.mateimarica.dev/scripts/toasts.mjs';

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

let style = getComputedStyle(document.body)
let secondaryBackgroundColor = style.getPropertyValue('--secondaryBackgroundColor');
let sectionCardColor = style.getPropertyValue('--sectionCardColor');

let complaintField = $('#complaintField');
complaintField.style.height = complaintField.scrollHeight + 'px';

let complaintsList = $('#complaintsList');
let lastKnownScrollPosition = 0;
let ticking = false;
document.addEventListener('scroll', (e) => {
	lastKnownScrollPosition = window.scrollY;

	if (!ticking) {
		ticking = true;

		window.requestAnimationFrame(() => {
			setNavbarTransparency(lastKnownScrollPosition);

			ticking = false;
		});
	}
});

let navigationBar = $('#navigationBar');
function setNavbarTransparency(scrollPos) {
	if(scrollPos > 0) {
		navigationBar.className = 'navigationBarOnScroll';
	} else {
		navigationBar.className = 'navigationBarOriginalPosition';
	}
}

// Makes the complaintField expand to accommodate its input text.
$('#complaintField').addEventListener('input', function() {
	this.style.height = "";
	this.style.height = this.scrollHeight + "px";
});

$('#formSubmit').addEventListener("click", () => {
	recentSubmission = true;

	let complaintForm = $('#complaintForm');
	let complaint = complaintField.value;

	// If there's nothing in the complaintField, alert the user
	// Or, if there are only spaces in the complaint. trim() would make a space-only string into '', which is falsy
	if (complaint === '' || !complaint.trim()) {
		displayToast("Can't leave the feedback field blank!");
		complaintField.classList.add('complaintFieldError');
		return;
	}

	let nameField = complaintForm.querySelector('#nameField');

	// Create the new complaint object
	const newComplaint = JSON.stringify({
		name: nameField.value,
		complaint: complaint
	});

	// Send the request with the complaint object
	const http = new XMLHttpRequest();
	sendHttpRequest(http, 'POST', '/api/complaints', () => {
		switch (http.status) {
			case 201:
				displayToast("Your feedback has been submitted.", { type: 'alert' });
				nameField.value = ''; // Clear fields
				complaintField.value = '';
				break;
			case 429:
				displayToast(http.responseText);
				break;
			default:
				displayToast("Something went wrong. Status code: " + http.status);
		}
	}, newComplaint);
});

function sendHttpRequest(http, method, suburl, callback=null, data=null) {
	const url = `${window.location.protocol}//${window.location.host + suburl}`;
	http.addEventListener('load', callback); // If ready state is 4, do async callback
	http.open(method, url, true);
	http.setRequestHeader("Content-Type", "application/json");
	http.send(data);
}

async function simulateTyping(element, text) {
	for (let i = 0; i < text.length; i++) {
		element.textContent += text.charAt(i);
		await sleep(randomInt(20, 40));
	}
}

/** A simple sleep function. Obviously, only call this from async functions. */
function sleep(milli) {
	return new Promise(resolve => {
		setTimeout(() => { resolve() }, milli);
	});
}

function randomInt(floorNum, ceilNum) {
    return floorNum + Math.floor((Math.random() * (ceilNum - floorNum + 1)));
}

// Remove red outline on complaint field and remove messageBox on new typing
let recentSubmission = false; // This variable exists so we don't change the DOM for every key we type. It is set to true when the Submit button is clicked
complaintField.addEventListener('input', function() {
	if (recentSubmission) {
		recentSubmission = false;
		this.classList.remove('complaintFieldError');
		$('#messageBox').className = 'hiddenMessageBox';
	}
});

const emailField = $('#emailField');

emailField.addEventListener("click", () => {
	let b = 'imaric';
	let c = 'a.dev@gm';
	let a = 'mate';
	let d = 'ail.com'

	let emailChunks = [b, c, a, d];
	let email = emailChunks[2] + emailChunks[0] + emailChunks[1] + emailChunks[3];
	let element = emailField.parentElement;
	emailField.remove();

	simulateTyping(element, email);
});