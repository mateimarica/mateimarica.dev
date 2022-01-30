let sessionId = '',
    usedSpace = 0,
    totalSpace = 0;


let lastKnownScrollPosition = 0,
    ticking = false;
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
      usernameField = document.querySelector('#usernameField');
      submitBtn = document.querySelector('#submitBtn');

[usernameField, passwordField].forEach(field => {
	field.addEventListener('keydown', (e) => {
		if (e.code === 'Enter') {
			submitBtn.click();
		}
	});
});

submitBtn.addEventListener('click', () => {
	const username = usernameField.value,
	      password = passwordField.value;

	if (!username || username === '') return;

	const headers = {
		'Username': username,
		'Authorization': btoa(password)
	}

	sendHttpRequest('POST', '/login', {headers: headers}, (http) => {
		// These alerts are placeholders
		switch (http.status) {
			case 200:
				sessionId = http.getResponseHeader('Authorization');
				document.body.innerHTML = http.responseText;
				setUpMainPage();
				break;
			case 401:
				alert('Invalid credentials, try again.');
				break;
			case 429:
				alert('Too many failed attempts. Try again later.');
				break;
			case 500:
			case 502:
				alert('Server error. Try again later.');
				break;
			default:
				alert('Something went wrong. Status code: ' + http.status);
		}
	});

	passwordField.value = '';
});

function setUpMainPage() {
	navigationBar = document.querySelector('#navigationBar');

	function refreshPageInfo(causedByDelete=false) {
		sendHttpRequest('GET', '/files', {headers: {'Authorization': sessionId}}, (http) => {
			switch (http.status) {
				case 200:
					fillMainPage(JSON.parse(http.responseText), causedByDelete);
					break;
				default:
			}
		});
	}

	refreshPageInfo();
	
	function uploadFiles(files) {
		if (files.length === 0) return;

		const formData = new FormData();

		let totalSize = 0;
		for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
			totalSize += files[i].size;
   		 }

		if (usedSpace + totalSize > totalSpace) {
			alert(`You don't have enough space for that.\nYou would need an extra ${getFormattedSize(usedSpace + totalSize - totalSpace)} of space.`);
			return;
		}

		const filePickerDropAreaLabel = document.querySelector('#filePickerDropAreaLabel'),
		      formerFilePickerDropAreaLabelText = filePickerDropAreaLabel.innerHTML,
		      filePickerDropArea = document.querySelector('#filePickerDropArea'),
		      filePicker = document.querySelector('#filePicker');

		const options = {
			data: formData,
			headers: {'Authorization': sessionId},
			uploadOnProgress: (e) => {
				const percent = Math.floor(100 * e.loaded / e.total);
				filePickerDropAreaLabel.innerHTML = getFormattedSize(e.loaded) + ' / ' + getFormattedSize(e.total) + '<br>' + percent + '%';
				filePickerDropArea.style.background = 'linear-gradient(90deg, var(--oddComplaintsBackgroundColor) ' + percent + '%, rgba(0,0,0,0)' + percent + '%)';
			}
		}

		filePickerDropArea.classList.add('inProgressFilePickerDropArea');
		filePicker.classList.add('inProgressFilePicker');
		filePicker.disabled = true;

		sendHttpRequest('POST', '/upload', options, (http) => {
			filePickerDropAreaLabel.innerHTML = formerFilePickerDropAreaLabelText;
			filePickerDropArea.classList.remove('inProgressFilePickerDropArea');
			filePicker.classList.remove('inProgressFilePicker');
			filePicker.disabled = false;
			filePickerDropArea.style.background = '';
			switch (http.status) {
				case 200:
					refreshPageInfo();
					break;
				case 413:
					// File is too large. Shouldn't reach this but w/e if it does
					break;
				default:
			}
		});
	}

	const filePickerDropArea = document.querySelector('#filePickerDropArea'),
	      filePicker = document.querySelector('#filePicker');

	['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
		filePickerDropArea.addEventListener(eventName, e => {
			e.preventDefault();
			e.stopPropagation();
		}, false);
	});


	['dragenter', 'dragover'].forEach(eventName => {
		filePickerDropArea.addEventListener(eventName, e => {
			if (!filePicker.disabled)
				filePickerDropArea.classList.add('highlightedFilePickerDropArea');
		}, false);
	});

	['dragleave', 'drop'].forEach(eventName => {
		filePickerDropArea.addEventListener(eventName, e => {
			if (!filePicker.disabled)
				filePickerDropArea.classList.remove('highlightedFilePickerDropArea');
		}, false);
	});

	filePickerDropArea.addEventListener('drop', e => {
		if (!filePicker.disabled)
			uploadFiles(e.dataTransfer.files);
	}, false);

	filePicker.addEventListener('change', function(e) {
		if (this.files.length > 0) {
			uploadFiles(this.files);
		}
	});

	document.querySelector("#xButton").addEventListener('click', () => {
		document.querySelector('#darkOverlay').style.display = 'none';
		document.querySelector('#sharePopup').style.display = 'none';
		const shareLinkField = document.querySelector('#shareLinkField');
		shareLinkField.style.display = 'none';
		shareLinkField.value = '';
		document.documentElement.style.overflow = '';
		const createLinkBtn = document.querySelector('#createLinkBtn');
		createLinkBtn.outerHTML = createLinkBtn.outerHTML; // remove all event listeners
	});

	document.querySelector("#darkOverlay").addEventListener('click', () => {
		document.querySelector("#xButton").click();
	});
	

	function setRadioButtons(elementArr, activeClassName) {
		return function() {
			this.classList.add(activeClassName);
			for (let i = 0; i < elementArr.length; i++) {
				if (this === elementArr[i]) continue;
				elementArr[i].classList.remove(activeClassName);
			}
		}
	}

	[
		{
			selectorClass: '.downloadLimitSelector', 
			fieldSelectorClass: '.downloadLimitField', 
			activeSelectorClass: 'activeDownloadLimitSelector' 
		},
		{
			selectorClass: '.validityPeriodSelector',  
			fieldSelectorClass: '.validityPeriodField', 
			activeSelectorClass: 'activeValidityPeriodSelector'
		},
	].forEach(selectorGroup => {
		let selectors = document.querySelectorAll(selectorGroup.selectorClass);
		for (let i = 0; i < selectors.length; i++) {
			selectors[i].addEventListener('click', setRadioButtons(selectors, selectorGroup.activeSelectorClass));
		}
	
		let selectorFields = document.querySelectorAll(selectorGroup.fieldSelectorClass);
		for (let i = 0; i < selectorFields.length; i++) {
			selectorFields[i].addEventListener('keydown', setRadioButtons(selectors, selectorGroup.activeSelectorClass));
		}
	});

	function fillMainPage(filesInfo, causedByDelete) {
		usedSpace = filesInfo.usedSpace;
		totalSpace = filesInfo.totalSpace;

		document.querySelector('#storageBarLabel').innerHTML = getFormattedSize(usedSpace) + " used / " + getFormattedSize(totalSpace) + ' total';
		let usedSpacePercent = (usedSpace / totalSpace * 100).toFixed(1); // Percent with 1 decimal space
		if (usedSpacePercent < 1 && usedSpace > 0) {
			usedSpacePercent = 0.05;
		} else if (usedSpacePercent > 100) {
			usedSpacePercent = 100;
		}

		setTimeout(() => {
			document.querySelector('#storageBarUsed').style.width = usedSpacePercent + '%';
	 	}, 10);

		let filesList = document.querySelector('#filesList');

		const currentDate = new Date();
		let files = filesInfo.files;

		if (files.length > 0)
			filesList.innerHTML = ''; // Removes the default list item
		else
		 	filesList.innerHTML = `<li class="filesListItem"><span class="filesListItemComponentLeft">Looks like there's nothing here. Hmm...</span></li>`;

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
			
			let deleteButton = document.createElement('span');
			deleteButton.classList.add('icon', 'deleteIcon');
			deleteButton.addEventListener('click', () => {

				if (!confirm('Are you sure you want to delete ' + files[i].baseName + '?')) {
					return;
				}

				const options = {
					headers: {
						'Filename': files[i].baseName,
						'Authorization': sessionId
					}
				};

				sendHttpRequest('DELETE', '/delete', options, (http) => {
					switch (http.status) {
						case 204:
							refreshPageInfo();
							break;
						default:
					}
				});
			});
			
			let shareButton = document.createElement('span');
			shareButton.classList.add('icon', 'shareIcon');
			shareButton.addEventListener('click', () => {
				document.querySelector('.downloadLimitSelector').click();
				document.querySelector('.validityPeriodSelector').click();

				['.downloadLimitField', '.validityPeriodField'].forEach(fieldSelectorClass => {
					document.querySelectorAll(fieldSelectorClass).forEach(fieldSelector => {
						fieldSelector.value = '';
					});
				});

				document.querySelector('#sharePopupFilename').textContent = files[i].baseName;
				document.querySelector('#sharePopupUploadDate').textContent = 'Uploaded ' + date.textContent;
				document.querySelector('#sharePopupSize').textContent = size.textContent;

				document.querySelector('#sharePopup').style.display = 'block';
				document.querySelector('#darkOverlay').style.display = 'block';
				document.documentElement.style.overflow = 'hidden';

				document.querySelector('#createLinkBtn').addEventListener('click', () => {
					const limit = document.querySelector('.activeDownloadLimitSelector').value,
					      validity = document.querySelector('.activeValidityPeriodSelector').value;

					const body = JSON.stringify({
						name: files[i].baseName,
						limit: Number(limit), // convert to number b/c they may be strings
						validity: Number(validity)
					});

					const options = {
						headers: {
							'Authorization': sessionId,
							'Content-Type': 'application/json'
						},
						data: body
					};
		
					sendHttpRequest('POST', '/share', options, (http) => {
						switch (http.status) {
							case 201:
								const url = JSON.parse(http.responseText).url;
								navigator.clipboard.writeText(url);
								const shareLinkField = document.querySelector('#shareLinkField');
								shareLinkField.style.display = 'inline-block';
								shareLinkField.value = url;
								break;
							default:
						}
					});
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
			
			filesListItem.append(filename, size, date, deleteButton, shareButton, downloadButton);
			filesList.appendChild(filesListItem);
		}
	}
}

/** {headers: {'Content-Type': 'application/json', 'Header1':'value'}, responseType: 'type', data: 'some data'} */
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
	       rect.top < (window.innerHeight || document.documentElement.clientHeight);
}