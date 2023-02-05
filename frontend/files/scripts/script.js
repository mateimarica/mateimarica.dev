const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

let accessToken = null,
    refreshToken = null,
    inviteAccessToken = null,
    loggedIn = false; // general boolean for being logged info, regardless of persistency of session
    usedSpace = 0,
    totalSpace = 0;

let lastKnownScrollPosition = 0,
    ticking = false;

const app = $('#app');

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

const passwordField = $('#passwordField'),
      usernameField = $('#usernameField');
      submitBtn = $('#submitBtn');

[usernameField, passwordField].forEach(field => {
	field.addEventListener('keydown', (e) => {
		if (e.code === 'Enter') {
			submitBtn.click();
		}
	});
});

const stayLoggedInCheckbox = $('#stayLoggedInCheckbox');

$('#stayLoggedInCheckbox + .checkboxLabel').addEventListener('keydown', (e) => {
	if (e.code === 'Enter') {
		stayLoggedInCheckbox.checked = !stayLoggedInCheckbox.checked; // toggle checkbox
	}
});

submitBtn.addEventListener('click', () => {
	const username = usernameField.value,
	      password = passwordField.value;

	if (!username || username === '') return;

	const persistentSession = $('#stayLoggedInCheckbox').checked; // boolean

	const options = {
		headers:  {
			'Username': username,
			'Authorization': btoa(password),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			persistentSession: persistentSession
		})
	}

	sendHttpRequest('POST', '/login', options, (http) => {
		// These alerts are placeholders
		switch (http.status) {
			case 200:
				if (!persistentSession) {
					accessToken  = http.getResponseHeader("Access-Token");
					refreshToken = http.getResponseHeader("Refresh-Token");
				}
				app.innerHTML = http.responseText;
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

function logout() {
	let options = {};
	if (refreshToken) {
		options = {headers: {'Refresh-Token': refreshToken}};
	}
	sendHttpRequest('DELETE', '/login/refresh', options, (http) => {
		accessToken = null, refreshToken = null;
		switch (http.status) {
			case 204:
			case 401: // log out even if session not valid
				window.location.reload();
				break;
			case 500:
			case 502:
				alert('Server error. Try again later.');
				break;
			default:
				alert('Something went wrong. Status code: ' + http.status);
		}
	});
}

function setUpMainPage(isInvite=false) {
	loggedIn = true;
	function refreshPageInfo(onFinishCallback=null) {
		sendHttpRequest('GET', '/files', {}, (http) => {
			switch (http.status) {
				case 200:
					fillMainPage(JSON.parse(http.responseText));
					break;
				default:
			}
			if (onFinishCallback !== null) {
				onFinishCallback();
			}
		});
	}

	refreshPageInfo();
	
	function mainUploadFiles(files) {
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

		const filePickerDropAreaLabel = $('#filePickerDropAreaLabel'),
		      formerFilePickerDropAreaLabelText = filePickerDropAreaLabel.innerHTML,
		      filePickerDropArea = $('#filePickerDropArea'),
		      filePicker = $('#filePicker');

		const options = {
			body: formData,
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

	function setRadioButtons(elementArr, activeClassName) {
		return function() {
			this.classList.add(activeClassName);
			for (let i = 0; i < elementArr.length; i++) {
				if (this === elementArr[i]) continue;
				elementArr[i].classList.remove(activeClassName);
			}
		}
	}

	setUpFilePicker(mainUploadFiles);

	function showDarkOverlayForPopup() {
		$('#darkOverlay').style.display = 'block';
		document.documentElement.style.overflow = 'hidden';
	}

	function fillMainPage(filesInfo) {
		usedSpace = filesInfo.usedSpace;
		totalSpace = filesInfo.totalSpace;

		$('#storageBarLabel').innerHTML = getFormattedSize(usedSpace) + " used / " + getFormattedSize(totalSpace) + ' total';
		let usedSpacePercent = (usedSpace / totalSpace * 100).toFixed(1); // Percent with 1 decimal space
		if (usedSpacePercent < 1 && usedSpace > 0) {
			usedSpacePercent = 0.05;
		} else if (usedSpacePercent > 100) {
			usedSpacePercent = 100;
		}

		setTimeout(() => {
			$('#storageBarUsed').style.width = usedSpacePercent + '%';
	 	}, 10);

		let filesList = $('#filesList');

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
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						baseName: files[i].baseName,
						uploader: files[i].uploader,
						inviteId: files[i].inviteId
					})
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

			filesListItem.append(filename, size, date, deleteButton);

			if (!isInvite) {
				let shareButton = document.createElement('span');
				shareButton.classList.add('icon', 'shareIcon');
				shareButton.addEventListener('click', () => {
					
					// Selects the first selector by default
					$('.shareDownloadLimitSelector').click();
					$('.shareValidityPeriodSelector').click();
	
					['.downloadLimitField', '.validityPeriodField'].forEach(fieldSelectorClass => {
						$$(fieldSelectorClass).forEach(fieldSelector => {
							fieldSelector.value = '';
						});
					});
	
					$('#sharePopupFilename').textContent = files[i].baseName;
					$('#sharePopupUploadDate').textContent = 'Uploaded ' + date.textContent;
					$('#sharePopupSize').textContent = size.textContent;
	
					$('#sharePopup').style.display = 'block';
					showDarkOverlayForPopup();
	
					$('#createShareLinkBtn').addEventListener('click', () => {
						const limit = $('.shareActiveDownloadLimitSelector').value,
						      validity = $('.shareActiveValidityPeriodSelector').value,
						      forceDownload = $('#forceDownloadCheckbox').checked;
	
						const options = {
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								name: files[i].baseName,
								limit: Number(limit), // convert to number b/c they may be strings
								validity: Number(validity),
								forceDownload: Boolean(forceDownload)
							})
						};
			
						sendHttpRequest('POST', '/share', options, (http) => {
							switch (http.status) {
								case 201:
									const url = JSON.parse(http.responseText).url;
									navigator.clipboard.writeText(url);
									const shareLinkField = $('#shareLinkField');
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
	
					const options = {
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							baseName: files[i].baseName,
							uploader: files[i].uploader
						})
					};
	
					sendHttpRequest('POST', '/download/request', options, async (http) => {
						switch (http.status) {
							case 200:
								let a = document.createElement('a');
								a.href = '/download?key=' + http.getResponseHeader('Authorization');
								a.click();
			
								await sleep(1000);
								downloadButton.className = '';
								downloadButton.classList.add('icon', 'downloadIcon');
								break;
							default:
						}
					});
				});
				filesListItem.append(shareButton, downloadButton);
			}
			filesList.appendChild(filesListItem);
		}
	}

	if (!isInvite) {
		let refreshButton = $('#refreshButton');
		refreshButton.addEventListener('click', async () => {
			refreshPageInfo();
			refreshButton.classList.add('refreshing');
			await sleep(1000);
			refreshButton.classList.remove('refreshing');
		});

		let logoutButton = $('#logoutButton');
		logoutButton.addEventListener('click', logout);

		$$('.xButton').forEach(xButton => {
			xButton.addEventListener('click', function() {
				$('#darkOverlay').style.display = 'none';
				this.parentElement.style.display = 'none';
				const shareLinkField = $('#shareLinkField');
				shareLinkField.style.display = 'none';
				shareLinkField.value = '';
				document.documentElement.style.overflow = '';
				const createShareLinkBtn = $('#createShareLinkBtn');
				createShareLinkBtn.outerHTML = createShareLinkBtn.outerHTML; // remove all event listeners
				const createInviteLinkBtn = $('#createInviteLinkBtn');
				createInviteLinkBtn.outerHTML = createInviteLinkBtn.outerHTML; // remove all event listeners
			});
		});
	
		$("#darkOverlay").addEventListener('click', () => {
			$$('.xButton').forEach((xButton) => {
				xButton.click();
			});
		});

		[
			{
				selectorClass: '.shareDownloadLimitSelector', 
				fieldSelectorClass: '.shareDownloadLimitField', 
				activeSelectorClass: 'shareActiveDownloadLimitSelector' 
			},
			{
				selectorClass: '.shareValidityPeriodSelector',  
				fieldSelectorClass: '.shareValidityPeriodField', 
				activeSelectorClass: 'shareActiveValidityPeriodSelector'
			},
			{
				selectorClass: '.inviteValidityPeriodSelector',  
				fieldSelectorClass: '.inviteValidityPeriodField', 
				activeSelectorClass: 'inviteActiveValidityPeriodSelector'
			},
			{
				selectorClass: '.inviteMaxUploadSizeSelector',  
				fieldSelectorClass: '.inviteMaxUploadSizeField', 
				activeSelectorClass: 'inviteActiveMaxUploadSizeSelector'
			},
		].forEach(selectorGroup => {
			let selectors = $$(selectorGroup.selectorClass);
			for (let i = 0; i < selectors.length; i++) {
				selectors[i].addEventListener('click', setRadioButtons(selectors, selectorGroup.activeSelectorClass));
			}
		
			let selectorFields = $$(selectorGroup.fieldSelectorClass);
			for (let i = 0; i < selectorFields.length; i++) {
				selectorFields[i].addEventListener('keydown', setRadioButtons(selectors, selectorGroup.activeSelectorClass));
			}
		});

		// Remove red outline on invite name field 
		var recentInviteAttempt = false; // This variable exists so we don't change the DOM for every key we type. 
		                           // It is set to true when the Copy Link button is clicked
		$('#inviteNameField').addEventListener('input', function() {
			if (recentInviteAttempt) {
				recentInviteAttempt = false;
				this.classList.remove('fieldError');
			}
		});

		$('#inviteButton').addEventListener('click', () => {
			$('#inviteNameField').classList.remove('fieldError');
			$('.inviteValidityPeriodSelector').click();
			$('.inviteMaxUploadSizeSelector').click();
		
			['.downloadLimitField', '.validityPeriodField'].forEach(fieldSelectorClass => {
				$$(fieldSelectorClass).forEach(fieldSelector => {
					fieldSelector.value = '';
				});
			});
		
			$('#invitePopup').style.display = 'block';
			showDarkOverlayForPopup();
		
			$('#createInviteLinkBtn').addEventListener('click', () => {
				recentInviteAttempt = true;

				const name = $('#inviteNameField').value,
					  message = $('#inviteMessageField').value,
					  maxUploadSize = $('.inviteActiveMaxUploadSizeSelector').value,
					  validity = $('.inviteActiveValidityPeriodSelector').value;
	
				if (name === '' || !name.trim()) {
					$('#inviteNameField').classList.add('fieldError');
					return;
				}

				const options = {
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						name: name,
						message: message,
						maxUploadSize: Number(maxUploadSize * 1000000000), // Convert from GB to bytes
						validity: Number(validity)
					})
				};
	
				sendHttpRequest('POST', '/invite', options, (http) => {
					switch (http.status) {
						case 201:
							const url = JSON.parse(http.responseText).url;
							navigator.clipboard.writeText(url);
							const inviteLinkField = $('#inviteLinkField');
							inviteLinkField.style.display = 'inline-block';
							inviteLinkField.value = url;
							break;
						default:
					}
				});
			});
		});

		// Makes the complaintField expand to accommodate its input text.
		$('#inviteMessageField').addEventListener('input', function() {
			this.style.height = "";
			this.style.height = this.scrollHeight + "px";
		});
	}
}

function setUpFilePicker(uploadFilesFunction) {
	const filePickerDropArea = $('#filePickerDropArea'),
	      filePicker = $('#filePicker');

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
			uploadFilesFunction(e.dataTransfer.files);
	}, false);

	filePicker.addEventListener('change', function(e) {
		if (this.files.length > 0) {
			uploadFilesFunction(this.files);
		}
	});
}

/** {headers: {'Content-Type': 'application/json', 'Header1':'value'}, responseType: 'type', body: 'some data'} */
function sendHttpRequest(method, url, options, callback) {

	const http = new XMLHttpRequest();
	http.addEventListener('load', async (e) => { // If ready state is 4, do async callback
		if (http.status === 444) { // 444 means access token invalid, so we try refresh token
			let refreshOptions = {};
			if (refreshToken) {
				refreshOptions = {headers: {'Refresh-Token': refreshToken}};
			}
			
			sendHttpRequest('POST', '/login/refresh', refreshOptions, (http2) => {
				switch (http2.status) {
					case 200:
						if (refreshToken) {
							accessToken  = http2.getResponseHeader("Access-Token");
							refreshToken = http2.getResponseHeader("Refresh-Token");
						}
						sendHttpRequest(method, url, options, callback);
						return;
					default:
						accessToken = null, refreshToken = null;
						if (loggedIn) {
							app.remove(); // delete the app div so sensitive info is not visible
							setTimeout(() => { // 10 milli delay so DOM can update before native alert freezes everything
								alert('Your session expired and could not be refreshed.\nYou will redirected to the login page.');
								window.location.reload();
							}, 10);
						} else {
							callback(http2, e);
						}
				}
			});
		} else {
			callback(http, e);
		}
	});

	if (options.uploadOnProgress)
		http.upload.onprogress = options.uploadOnProgress;

	http.open(method, url, async=true);

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

	http.send(options.body ?? null);
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

const MILLI_PER_MIN = 60000,
      MINS_PER_HOUR = 60,
      MINS_PER_DAY = 1440,
      MINS_PER_WEEK = 10080,
      MINS_PER_MONTH = 43200,
      MINS_PER_YEAR = 525600;

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

const KILOBYTE = 1000,
      MEGABYTE = 1000000,
      GIGABYTE = 1000000000;

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

// Check for invite after DOM loads
document.addEventListener('DOMContentLoaded', (e) => {
	const urlParams = new URLSearchParams(window.location.search);
	const inviteCode = urlParams.get('invite');
	if (inviteCode) {
		sendHttpRequest('GET', '/invite?id=' + inviteCode, {}, (http) => {
			switch (http.status) {
				case 200:
					inviteAccessToken = http.getResponseHeader("Invite-Access-Token");
					app.innerHTML = http.responseText;
					setUpMainPage(true);
					return;
				case 404:
					var alertMessage = 'Invitation doesn\'t exist.';
					break;
				case 500:
				case 502:
					var alertMessage = 'Server error. Try again later.';
					break;
				default:
					var alertMessage = 'Something went wrong. Status code: ' + http.status;
			}

			setTimeout(() => { // 10 milli delay so DOM can update before native alert freezes everything
				alert(alertMessage);

				// Remove query string from URL so that the error alert doesn't show again on refresh
				window.history.pushState({}, '', window.location.origin);
				showLoginForm();
			}, 10);
		});
	} else if (location.pathname === '/') { // try to login with cookies
		sendHttpRequest('GET', '/login/access', {}, (http) => {
			switch (http.status) {
				case 200:
					app.innerHTML = http.responseText;
					setUpMainPage();
					return;
				default:
					console.info('Unable to log in with cookies (if there are any)');
			}
			showLoginForm();
		});
	}
});

function showLoginForm() {
	$('#loginCard').style.display = 'block';
}