const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

let style = getComputedStyle(document.body)
let secondaryBackgroundColor = style.getPropertyValue('--secondaryBackgroundColor');
let sectionCardColor = style.getPropertyValue('--sectionCardColor');

let complaintField = $('#complaintField');
complaintField.style.height = complaintField.scrollHeight + 'px';

let UNBTooltip = $('#UNBtooltip');
let tooltipPopup = UNBTooltip.querySelector('span');
let tooltipMouseOver = false
UNBTooltip.addEventListener('mouseover', function() {
	tooltipMouseOver = true;
	// If tooltip is too wide, wrap it
	if (tooltipPopup.getBoundingClientRect().right > window.innerWidth) {
		tooltipPopup.style.whiteSpace = 'normal';
		tooltipPopup.style.top = '-1em';

		// If it's still too wide, put it underneath (Add 25px so it's not too close to the edge of screen)
		if (tooltipPopup.getBoundingClientRect().right + 25 > window.innerWidth) {
			tooltipPopup.style.top = '1.6em';
			tooltipPopup.style.left = '0%';
		}
	}

	// Set fake inverted styling
	let bodyCard = $('#bodyCard');
	let distanceFromTooltipToCardEdge = Math.floor(bodyCard.getBoundingClientRect().right - tooltipPopup.getBoundingClientRect().left);
	tooltipPopup.style.background = `linear-gradient(90deg, ${secondaryBackgroundColor} ${distanceFromTooltipToCardEdge}px, ${sectionCardColor} ${distanceFromTooltipToCardEdge}px)`;
});

// Reset tooltip styling in case it was wrapped on mouseover/hover
UNBTooltip.addEventListener('mouseleave', () => {
	tooltipMouseOver = false;
});

UNBTooltip.addEventListener('transitionend', () => {
	if (!tooltipMouseOver) {
		tooltipPopup.style.whiteSpace = 'nowrap';
		tooltipPopup.style.top = '0';
		tooltipPopup.style.left = '130%';
	}
});

let complaintsList = $('#complaintsList');
let lastKnownScrollPosition = 0;
let ticking = false;
document.addEventListener('scroll', (e) => {
	lastKnownScrollPosition = window.scrollY;

	if (!ticking) {
		ticking = true;

		window.requestAnimationFrame(() => {
			setNavbarTransparency(lastKnownScrollPosition);
			displayComplaintsList();
			
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

function displayComplaintsList() {
	if(fillComplaintsListCallback != null && isElementInViewport(complaintsList)) {
		fillComplaintsListCallback();
		fillComplaintsListCallback = null;
		return true;
	}
	return false;
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
		setMessageBox('errorMessageBox', "\u26A0 Can't leave the complaint field blank!");
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
				setMessageBox('successMessageBox', "\u2714  Your complaint has been submitted.\r\nIt will be displayed once it's approved.");
				nameField.value = ''; // Clear fields
				complaintField.value = '';
				break;
			case 429:
				setMessageBox('errorMessageBox', "\u2717 " + http.responseText);
				break;
			default:
				setMessageBox('errorMessageBox', "\u2717  Something went wrong. Status code: " + http.status);
		}
	}, newComplaint);
});

function setMessageBox(className, text) {
	let messageBox = $('#messageBox');
	messageBox.className = className;
	messageBox.textContent = text;
	window.scrollBy(0, 100); // Scroll 100px down so the submit button is still visible
}

function sendHttpRequest(http, method, suburl, callback=null, data=null) {
	const url = `${window.location.protocol}//${window.location.host + suburl}`;
	http.addEventListener('load', callback); // If ready state is 4, do async callback
	http.open(method, url, async=true);
	http.setRequestHeader("Content-Type", "application/json");
	http.send(data);
}

let fillComplaintsListCallback = null;
// Runs once the page is fully loaded
window.addEventListener('load', () => {
	
	// Go and get the recent complaints
	const http = new XMLHttpRequest();
	sendHttpRequest(http, 'GET', '/api/complaints', () => {
		if (http.status === 200) {
			
			let complaints = JSON.parse(http.responseText);
			
			if (complaints.length === 	0) return;
			
			if (isElementInViewport(complaintsList)) {
				fillComplaintsList(complaints)
			} else {
				fillComplaintsListCallback = () => { fillComplaintsList(complaints) };	
			}
		} else {
			let complaintsListDefaultItem = $('#complaintsList li');
			switch (http.status) { 
				case 429: // If too many requests
					complaintsListDefaultItem.textContent = http.responseText;
					break;
				default:
					complaintsListDefaultItem.textContent = 'Something went wrong. Status code: ' + http.status;
			}
		}
	});
});

async function fillComplaintsList(complaints) {
	let complaintsList = $('#complaintsList');
	complaintsList.innerHTML = ''; // Removes the default list item
	
	let currentDate = new Date();

	complaints.forEach(async (complaint, i) => {
		let relativeTime = getRelativeTime(complaint.created_at, currentDate);
		let complaintsListItem = document.createElement('li');
		complaintsListItem.classList.add('complaintsListItem', 'complaintsListItemInvisible');
		complaintsListItem.focus();

		let complaintsListItemInfo = document.createElement('span');
		complaintsListItemInfo.classList.add('complaintsListItemInfo');
		complaintsListItemInfo.textContent = `${relativeTime}, ${complaint.name} wrote:`;

		let complaintsListItemText = document.createElement('span');
		complaintsListItemText.classList.add('complaintsListItemText');

		complaintsListItem.append(complaintsListItemInfo, complaintsListItemText);
		complaintsList.appendChild(complaintsListItem);
		simulateTypingComplaints(complaintsListItem, complaint.complaint);
		complaintsListItem.offsetTop; // Triggers a reflow; needed for transition to trigger
		complaintsListItem.classList.remove("complaintsListItemInvisible");
		await sleep(150);
	});
}

async function simulateTypingComplaints(complaintsListItem, complaint) {
	let complaintText = complaintsListItem.querySelector('.complaintsListItemText');
	for (let i = 0; i < complaint.length; i++) {
		complaintText.textContent += complaint.charAt(i);
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

const MILLI_PER_MIN = 60000;
const MINS_PER_HOUR = 60;
const MINS_PER_DAY = 1440;
const MINS_PER_WEEK = 10080; 
const MINS_PER_MONTH = 43200;
const MINS_PER_YEAR = 525600;

// Example: Converts "2020-11-15T23:11:01.000Z" to "a year ago"
function getRelativeTime(datetime, currentDate) {
	let date = new Date(Date.parse(datetime));

	const MINUTES_PASSED = Math.floor((Math.abs(currentDate - date)) / MILLI_PER_MIN); 

	// If less than an hour has passed, print minutes
	if(MINUTES_PASSED < MINS_PER_HOUR) {
		return MINUTES_PASSED + ((MINUTES_PASSED === 1) ? ' minute ago' : ' minutes ago');
	}

	// If less than an day has passed, print hours
	if(MINUTES_PASSED < MINS_PER_DAY) {
		let hoursPassed = Math.floor(MINUTES_PASSED / MINS_PER_HOUR);
		return hoursPassed + ((hoursPassed === 1) ? ' hour ago' : ' hours ago');
	}

	// If less than an week has passed, print days
	if(MINUTES_PASSED < MINS_PER_WEEK) {
		let daysPassed = Math.floor(MINUTES_PASSED / MINS_PER_DAY);
		return daysPassed + (daysPassed === 1 ? ' day ago' : ' days ago');
	}

	// If less than an month has passed, print weeks
	if(MINUTES_PASSED < MINS_PER_MONTH) {
		let weeksPassed = Math.floor(MINUTES_PASSED / MINS_PER_WEEK);
		return weeksPassed + (weeksPassed === 1 ? ' week ago' : ' weeks ago');
	}

	// If less than an year has passed, print months
	if(MINUTES_PASSED < MINS_PER_YEAR) {
		let monthsPassed = Math.floor(MINUTES_PASSED / MINS_PER_MONTH);
		return monthsPassed + (monthsPassed === 1 ? ' month ago' : ' months ago');
	}
}

function isElementInViewport(element) {
	let rect = element.getBoundingClientRect();
	return rect.bottom > 0 &&
	       rect.right > 0 &&
	       rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
	       rect.top< (window.innerHeight || document.documentElement.clientHeight);
}