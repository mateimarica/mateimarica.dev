let sessionId = '';

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

let navigationBar = document.querySelector('#navigationBar');
function setNavbarTransparency(scrollPos) {
	if(scrollPos > 0) {
		navigationBar.className = 'navigationBarOnScroll';
	} else {
		navigationBar.className = 'navigationBarOriginalPosition';
	}
}

const passwordField = document.querySelector('#passwordField'),
      submitBtn = document.querySelector('#submitBtn');

passwordField.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
        submitBtn.click();
    }
});

submitBtn.addEventListener('click', () => {
	const password = passwordField.value

	if (!password || password === '') return;

	sendHttpRequest('POST', '/login', {headers: {'Authorization': btoa(password)}}, (http) => {
		switch (http.status) {
			case 200:
				sessionId = http.getResponseHeader('Authorization');

				sendHttpRequest('GET', '/template.html', {}, (http) => {
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

// remove lines for PROD
passwordField.value = 'hello';
submitBtn.click();


function setUpMainPage() {
	navigationBar = document.querySelector('#navigationBar');

	function refreshPageInfo() {
		sendHttpRequest('GET', '/files', {headers: {'Authorization': sessionId}}, (http) => {
			switch (http.status) {
				case 200:
					fillMainPage(JSON.parse(http.responseText));
					break;
				default:
			}
		});
	}

	refreshPageInfo();
	
	function uploadFiles(files) {
		if (files.length === 0) return;

		const formData = new FormData();
	
		for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
   		 }

		sendHttpRequest('POST', '/upload', {data: formData, headers: {'Authorization': sessionId}}, (http) => {
			switch (http.status) {
				case 200:
					refreshPageInfo();
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

	function fillMainPage(filesInfo) {

		document.querySelector('#storageBarLabel').innerHTML = getFormattedSize(filesInfo.usedSpace) + " used / " + getFormattedSize(filesInfo.totalSpace) + ' total';
		let usedSpacePercent = (filesInfo.usedSpace / filesInfo.totalSpace * 100).toFixed(1); // Percent with 1 decimal space
		if (usedSpacePercent < 1 && filesInfo.usedSpace > 0) {
			usedSpacePercent = 0.05;
		} else if (usedSpacePercent > 100) {
			usedSpacePercent = 100;
		}

		setTimeout(() => {
			document.querySelector('#storageBarUsed').style.width = usedSpacePercent + '%';
	 	}, 10);

		let filesList = document.querySelector('#filesList');
		filesList.innerHTML = ''; // Removes the default list item
		
		const currentDate = new Date();
		let files = filesInfo.files;
		for (let i = 0; i < files.length; i++) {
			let filesListItem = document.createElement('li');
			filesListItem.classList.add('filesListItem');

			let filename = document.createElement('span');
			filename.classList.add('filesListItemComponentLeft');
			filename.innerHTML = files[i].baseName.length > 40 ? files[i].name.substring(0, 40) + '...' + files[i].ext : files[i].baseName;

			let size = document.createElement('span');
			size.classList.add('filesListItemTextComponent');
			size.innerHTML = getFormattedSize(files[i].size);

			let date = document.createElement('span');
			date.classList.add('filesListItemTextComponent');
			date.innerHTML = getRelativeTime(files[i].uploadDate, currentDate);

			let shareButton = document.createElement('span');
			shareButton.classList.add('icon', 'shareIcon');
			shareButton.addEventListener('click', () => {
				document.querySelector('#darkOverlay').style.display = 'block';
				document.querySelector('html').style.overflow = 'hidden';
				
				let sharePopup = document.querySelector('#sharePopup');
				sharePopup.style.display = 'block';
				// sharePopup.innerHTML += (files[i].baseName.length > 40 ? files[i].name.substring(0, 40) + '...' + files[i].ext : files[i].baseName); // bad

				document.querySelector("#xButton").addEventListener('click', () => {
					document.querySelector('#darkOverlay').style.display = 'none';
					document.querySelector('#sharePopup').style.display = 'none';
					document.querySelector('html').style.overflow = 'visible';
				});
			});


			let downloadButton = document.createElement('span');
			downloadButton.classList.add('icon', 'downloadIcon');
			downloadButton.addEventListener('click', () => {
				downloadButton.className = 'loadingIcon';

				sendHttpRequest('GET', '/download/request?name=' + btoa(files[i].baseName), {headers: {'Authorization': sessionId}}, async (http) => {
					let a = document.createElement('a');
					a.href = '/download?key=' + http.getResponseHeader('Authorization');
					a.click();

					await sleep(1000);
					downloadButton.className = '';
					downloadButton.classList.add('icon', 'downloadIcon');
				});
			});
			
			filesListItem.append(filename, size, date, shareButton, downloadButton);
			filesList.appendChild(filesListItem);
		}
	}
}


function sendHttpRequest(method, url, options, callback) {
	const http = new XMLHttpRequest();
	http.addEventListener('load', (e) => callback(http, e)); // If ready state is 4, do async callback

	http.open(method, url, async=true);

	if (options.headers)
		for (let key in options.headers) {
			http.setRequestHeader(key, options.headers[key]);
		}

	if (options.responseType)
		http.responseType = options.responseType;

	http.send(options.data ?? null);
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

	if (MINUTES_PASSED === 0)
		return 'Just now';

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

const KILOBYTE = 1000;
const MEGABYTE = 1000000;
const GIGABYTE = 1000000000;

// The parseFloat() removes trailing zeroes (eg: 1.0 -> 1)
function getFormattedSize(bytes) {
	if(bytes < KILOBYTE) {
		return bytes + ' B';
	}

	if(bytes < MEGABYTE) {
		return parseFloat((bytes / KILOBYTE).toFixed(1)) + ' KB';
	}

	if(bytes < GIGABYTE) {
		return parseFloat((bytes / MEGABYTE).toFixed(1)) + ' MB';
	}

	return parseFloat((bytes / GIGABYTE).toFixed(1)) + ' GB';
}

function isElementInViewport(element) {
	let rect = element.getBoundingClientRect();
	return rect.bottom > 0 &&
	       rect.right > 0 &&
	       rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
	       rect.top< (window.innerHeight || document.documentElement.clientHeight);
}