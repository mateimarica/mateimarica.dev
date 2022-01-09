
let sessionId = '';

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

let navigationBar = document.querySelector('#navigationBar');
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

const passwordField = document.querySelector('#passwordField'),
      submitBtn = document.querySelector('#submitBtn');


passwordField.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
        submitBtn.click();
    }
});

// remove line for PROD
passwordField.value = 'hello';

submitBtn.addEventListener('click', () => {
	const password = passwordField.value

	if (!password || password === '') return;

	sendHttpRequest('POST', '/login', null, {'Authorization': btoa(password)}, (http) => {
		switch (http.status) {
			case 200:
				sessionId = http.getResponseHeader('Authorization');


				sendHttpRequest('GET', '/template.html', null, [], (http) => {
					switch (http.status) {
						case 200:
							document.body.innerHTML = http.responseText;
							setUpMainPage();
							break;
						default:
					}
				});
				break;
			case 403:
			case 500:
			default:
		}
	});

	passwordField.value = '';
});

// remove line for PROD
submitBtn.click();

function setUpMainPage() {
	function uploadFiles(files) {
		const formData = new FormData();
	
		for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
   		 }

		sendHttpRequest('POST', '/upload', formData, {'Authorization': sessionId}, (http) => {
			switch (http.status) {
				case 200:
					break;
				default:
			}
		});
	}

	const filePickerDropArea = document.querySelector('#filePickerDropArea');

	['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
		filePickerDropArea.addEventListener(eventName, e => {
			e.preventDefault();
			e.stopPropagation();
		}, false);
	});

	['dragenter', 'dragover'].forEach(eventName => {
		filePickerDropArea.addEventListener(eventName, e => {
			filePickerDropArea.classList.add('highlightedFilePickerDropArea');
		}, false);
	});

	['dragleave', 'drop'].forEach(eventName => {
		filePickerDropArea.addEventListener(eventName, e => {
			filePickerDropArea.classList.remove('highlightedFilePickerDropArea');
		}, false);
	});

	filePickerDropArea.addEventListener('drop', e => {
		uploadFiles(e.dataTransfer.files);
	}, false);

	const filePicker = document.querySelector('#filePicker');

	filePicker.addEventListener('change', function(e) {
		if (this.files.length > 0) {
			uploadFiles(this.files);
		}
	});
	
	triggerTransitions();
}

async function triggerTransitions() {
	await sleep(100);
	document.querySelector('#storageBarUsed').style.width = '75%';
}

function setMessageBox(className, innerHTML) {
	let messageBox = document.querySelector('#messageBox');
	messageBox.className = className;
	messageBox.innerHTML = innerHTML;
	window.scrollBy(0, 100); // Scroll 100px down so the submit button is still visible
}

function sendHttpRequest(method, suburl, data, headers, callback=null) {
	const http = new XMLHttpRequest();
	const url = `${window.location.protocol}//${window.location.host + suburl}`;
	http.addEventListener('load', () => callback(http)); // If ready state is 4, do async callback
	http.open(method, url, async=true);
	for (let key in headers) {
		http.setRequestHeader(key, headers[key]);
	}
	http.send(data);
}

// Runs once the page is fully loaded
window.addEventListener('load', () => {

});

async function fillComplaintsList(complaints) {
	let complaintsList = document.querySelector('#complaintsList');
	complaintsList.innerHTML = ''; // Removes the default list item

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




////////////////////////////////////

