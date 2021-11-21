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

	// Create the new complaint object
	const newComplaint = JSON.stringify({
		name: complaintForm.querySelector('#nameField').value,
		complaint: complaint
	});

	// Send the request with the complaint object
	const http = new XMLHttpRequest();
	sendHttpRequest(http, 'POST', '/api/complaints', newComplaint, (e) => {
		// Deal with the response
		response = JSON.parse(http.responseText);
		console.log("POST request response: ", e, response.name);
	});
}

function sendHttpRequest(http, method, suburl, data=null, callback) {
	const url = `${window.location.protocol}//${window.location.host + suburl}`;
	http.addEventListener('load', callback);
	http.open(method, url, async=true);
	http.setRequestHeader("Content-Type", "application/json");
	http.send(data);
}