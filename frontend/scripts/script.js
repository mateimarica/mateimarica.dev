var style = getComputedStyle(document.body)
let secondaryBackgroundColor = style.getPropertyValue('--secondaryBackgroundColor');
let sectionContainerColor = style.getPropertyValue('--sectionContainerColor');

let complaintField = document.querySelector('#complaintField');
complaintField.style.height = complaintField.scrollHeight + 'px';

let UNBTooltip = document.querySelector('#UNBtooltip');
let tooltipPopup = UNBTooltip.querySelector('span');
UNBTooltip.addEventListener('mouseover', function() {

	// If tooltip is too wide, wrap it
	if (tooltipPopup.getBoundingClientRect().right > window.innerWidth) {
		tooltipPopup.style.whiteSpace = 'normal';
		tooltipPopup.style.top = '-1em';
	}

	// Set fake inverted styling
	let bodyContainer = document.querySelector('#bodyContainer');
	let distanceFromTooltipToContainerEdge = Math.floor(bodyContainer.getBoundingClientRect().right - tooltipPopup.getBoundingClientRect().left) - 1; // Minus 1 because it's a pixel off.. Not sure why
	tooltipPopup.style.background = `linear-gradient(90deg, ${secondaryBackgroundColor} ${distanceFromTooltipToContainerEdge}px, ${sectionContainerColor} ${distanceFromTooltipToContainerEdge}px)`;
});

// Reset tooltip styling in case it was wrapped on mouseover/hover
UNBTooltip.addEventListener('mouseleave', function() {
	tooltipPopup.style.whiteSpace = 'nowrap';
	tooltipPopup.style.top = '0';
});

function handleComplaintFormSubmission() {
	let complaintForm = document.querySelector('#complaintForm');
	let complaintField = complaintForm.querySelector('#complaintField');
	let complaint = complaintField.value;

	// If there's nothing in the complaintField, alert the user
	// Or, if there are only spaces in the complaint. trim() would make a space-only string into '', which is falsy
	if (complaint === '' || !complaint.trim()) {
		let errorMessage = document.querySelector('#errorMessage');
		errorMessage.style.display = 'block'; // Make errorBox appear
		errorMessage.innerHTML = "\u26A0 Can't leave the complaint field blank!";
		complaintField.style.border = '2px solid darkred'; // Highlight the empty complaintField
		window.scrollBy(0, 100); // Scroll 100px down so the submit button is still visible
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
		// Callback function isn't getting invoked because the POST request's ready state isn't getting updated.. It stops at 1. Not sure why.
	}, newComplaint);

	// Clear fields
	nameField.value = '';
	complaintField.value = '';

}

function sendHttpRequest(http, method, suburl, callback=null, data=null) {
	const url = `${window.location.protocol}//${window.location.host + suburl}`;
	http.addEventListener('load', callback); // If ready state is 4, do async callback
	http.open(method, url, async=true);
	http.setRequestHeader("Content-Type", "application/json");
	http.send(data);
}

// Runs once the page is fully loaded
window.addEventListener('load', () => {
	// Go and get the recent complaintsconsole.log('GET request response: ', http.status);
	const http = new XMLHttpRequest();
	sendHttpRequest(http, 'GET', '/api/complaints', () => {
		if (http.readyState === 4 && http.status === 200) {
			const complaints = JSON.parse(http.responseText);
			
			if(complaints.length === 0) return;

			let complaintsList = document.querySelector('#complaintsList');

			complaintsList.innerHTML = ''; // Removes the default list item

			let currentDate = new Date();

			complaints.forEach(complaint => {
				let relativeTime = getRelativeTime(complaint.created_at, currentDate);
				let complaintsListItem = document.createElement('li');
				complaintsListItem.className = 'complaintsListItem';
				complaintsListItem.innerHTML = `<span class="complaintsListItemInfo">${relativeTime}, ${complaint.name} wrote:</span><br><span class="complaintsListItemText">${complaint.complaint}</span>`;
				complaintsList.appendChild(complaintsListItem);
			});
		} else {
			console.err('Something went wrong with a GET request')
		}
	});
});

const MILLI_PER_MIN = 60000;
const MINS_PER_HOUR = 60;
const MINS_PER_DAY = 1440;
const MINS_PER_WEEK = 10080; 
const MINS_PER_MONTH = 43200;
const MINS_PER_YEAR = 525600;

// Example: Converts "2020-11-15T23:11:01.000Z" to "a year ago"
function getRelativeTime(datetime, currentDate) {
	let date = new Date(Date.parse(datetime));

	let minutesPassed = (Math.abs(currentDate - date)) / MILLI_PER_MIN; 

	// If less than an hour has passed, print minutes
	if(minutesPassed < MINS_PER_HOUR) {
		return Math.floor(minutesPassed) + ((minutesPassed == 1) ? ' minute ago' : ' minutes ago');
	}

	// If less than an day has passed, print hours
	if(minutesPassed < MINS_PER_DAY) {
		let hoursPassed = minutesPassed / MINS_PER_HOUR;
		return Math.floor(hoursPassed) + ((hoursPassed == 1) ? ' hour ago' : ' hours ago');
	}

	// If less than an week has passed, print days
	if(minutesPassed < MINS_PER_WEEK) {
		let daysPassed = minutesPassed / MINS_PER_DAY;
		return Math.floor(daysPassed) + (daysPassed == 1 ? ' day ago' : ' days ago');
	}

	// If less than an month has passed, print weeks
	if(minutesPassed < MINS_PER_MONTH) {
		let weeksPassed = minutesPassed / MINS_PER_WEEK;
		return Math.floor(weeksPassed) + (weeksPassed == 1 ? ' week ago' : ' weeks ago');
	}

	// If less than an year has passed, print months
	if(minutesPassed < MINS_PER_YEAR) {
		let monthsPassed = minutesPassed / MINS_PER_MONTH;
		return Math.floor(monthsPassed) + (monthsPassed == 1 ? ' month ago' : ' months ago');
	}
}