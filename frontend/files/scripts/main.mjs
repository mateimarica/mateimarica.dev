'use strict';

import { sendHttpRequest, setAccessToken, setRefreshToken, setInviteAccessToken, setLoggedIn, isInviteSession, logout} from './req-manager.mjs';
import { dynamicTextArea, sleep, getRelativeTime, getUtcOffsetTime, getFormattedSize } from './util.mjs';
import { displayToast } from './toasts.mjs';

// jquery-like shortcut for document-level queries
const $ = document.querySelector.bind(document),
      $$ = document.querySelectorAll.bind(document);

let usedSpace = 0,
    totalSpace = 0;

// navbar vars
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

const navigationBar = $('#navigationBar');
function setNavbarTransparency(scrollPos) {
	if(scrollPos > 0) {
		navigationBar.className = 'navigationBarOnScroll';
	} else {
		navigationBar.className = 'navigationBarOriginalPosition';
	}
}

const passwordField = $('#passwordField'),
      usernameField = $('#usernameField'),
      submitBtn = $('#submitBtn');

[usernameField, passwordField].forEach(field => {
	field.addEventListener('keydown', (e) => {
		if (e.code === 'Enter') submitBtn.click();
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

	if (!username) {
		return displayToast('Must enter a username');
	} else if (!password) {
		return displayToast('Must enter a password');
	}

	const arrowIcon = submitBtn.querySelector('.arrowIcon');
	arrowIcon.classList.add('rotatingLogin');

	const persistentSession = $('#stayLoggedInCheckbox').checked; // boolean

	login(username, password, persistentSession, () => {
		// End the rotation animation at the end of an iteration so it doesn't jump
		arrowIcon.onanimationiteration = () => {
			arrowIcon.classList.remove('rotatingLogin');
		};
	});

	passwordField.value = '';
});

// callback is called with boolean parameter. true if http status is 200, false otherwise
function login(username, password, persistentSession, callback) {
	const options = {
		headers:  {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			username: username,
			password: password,
			persistentSession: persistentSession
		})
	}

	sendHttpRequest('POST', '/login', options, { load: (http) => {
		switch (http.status) {
			case 200:
				if (!persistentSession) {
					setAccessToken(http.getResponseHeader("Access-Token"));
					setRefreshToken(http.getResponseHeader("Refresh-Token"));
				}
				app.innerHTML = http.responseText;
				setUpMainPage();
				return;
			case 401:
				displayToast('Invalid credentials, try again.');
				break;
			case 429:
				displayToast('Too many failed attempts. Try again later.');
				break;
			case 500:
			case 502:
				displayToast('Server error. Try again later.');
				break;
			default:
				displayToast('Something went wrong. Status code: ' + http.status);
		}

		callback(http.status === 200);
	}});
}

const darkOverlay = $('#darkOverlay');

$('#signupLink').addEventListener('click', () => {
	showDarkOverlayForPopup();
	$('#signupPopup').style.display = 'block';
});

function showDarkOverlayForPopup() {
	darkOverlay.style.display = 'block';
	document.documentElement.style.overflow = 'hidden';
}

// dark overlay persists after html switch
darkOverlay.addEventListener('click', () => {
	$$('.xButton').forEach((xButton) => {
		xButton.click();
	});
});

$('#resetPswdLink').addEventListener('click', () => {
	showDarkOverlayForPopup();
	$('#resetPswdPopup').style.display = 'block';
});

registerXButtons();
function registerXButtons() {
	$$('.xButton').forEach(xButton => {
		if (!xButton.hasAttribute('registered')) {
			xButton.setAttribute('registered', '');
			xButton.addEventListener('click', function() {
				darkOverlay.style.display = 'none';
				this.parentElement.style.display = 'none';
				document.documentElement.style.overflow = ''; // add scrolling back in after popup disables it
			});
		}
	});
}

function showGenericPopup(title, content) {
	const el = document.createElement('span');
	el.textContent = content;
	content = el.textContent;
	let asterisks = 0;
	for (let i = 0; i < content.length; i++) {
		if (content.charAt(i) === '*') {
			asterisks++;
			const tag = (asterisks % 2 === 0 ? '</b>' : '<b>');
			content = content.slice(0, i) + tag + content.slice(i + 1, content.length);
			i += (tag.length - 1);
		}
	}
	content = content.replaceAll('\n', '<br>');
	$$('.xButton').forEach(xButton => xButton.click());
	showDarkOverlayForPopup();
	$('#genericPopup').style.display = 'block';
	$('#genericPopup > [name=title]').textContent = title;
	$('#genericPopup > [name=content]').innerHTML = content;
}

function clearAllInputFields(selector) {
	document.querySelectorAll(`${selector} input`).forEach((e) => e.value = '');
}

$('#signupRequestBtn').addEventListener('click', function() {
	const username = $('#signupUsernameField').value,
	      password = $('#signupPasswordField').value,
	      passwordAgain = $('#signupPasswordField2').value,
	      email = $('#signupEmailField').value || null,
		  message = $('#signupMsgField').value || null;

	if (!username) return displayToast('Must enter a username');
	if (!password) return displayToast('Must enter a password');
	if (password !== passwordAgain) return displayToast('Passwords must match');
	if (email && /^\S+@\S+\.\S+$/.test(email) === false) return displayToast('Invalid email');
	if (!email && !confirm(`If you don't add an email, you won't know when your account gets activated.\n\nContinue anyway?`)) {
		return;
	}

	this.setAttribute('disabled', '');

	const options = {
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			username: username,
			password: passwordAgain,
			email: email,
			message: message
		})
	};

	sendHttpRequest('POST', '/signup', options, { load: (http) => {
		this.removeAttribute('disabled');
		switch (http.status) {
			case 201:
				showGenericPopup(
					'Account Request',
					`Your account request for *${username}* was created.\n\n${email ? `You will receive an email at *${email}* when your account is activated.` : `You didn't add an email, so just check back later.`}`
				);
				clearAllInputFields('#signupPopup');
				break;
			case 400:
			case 409:
			case 429:
				displayToast(http.responseText);
				break;
			case 500:
			case 502:
				displayToast('Server error. Try again later.');
				break;
			default:
				displayToast('Something went wrong. Status code: ' + http.status);
		}
	}});
});

const resetPswdEmailField = $('#resetPswdEmailField'),
      resetPswdBtn = $('#resetPswdBtn');

resetPswdEmailField.addEventListener('keydown', (e) => {
	if (e.code === 'Enter') resetPswdBtn.click();
});

resetPswdBtn.addEventListener('click', function() {
	const usernameOrEmail = resetPswdEmailField.value.trim();
	if (!usernameOrEmail) return displayToast('Must enter a username or email.');

	this.setAttribute('disabled', '');

	const options = {
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ usernameOrEmail: usernameOrEmail })
	};
	sendHttpRequest('POST', '/reset-password', options, { load: (http) => {
		this.removeAttribute('disabled', '');
		switch (http.status) {
			case 200:
				const isEmail = JSON.parse(http.responseText).isEmail;
				const content = isEmail 
				                ? `If *${usernameOrEmail}* is associated with an account`
				                : `If there is an account named *${usernameOrEmail}*`;

				showGenericPopup(
					'Reset Password',
					`${content}, you'll receive an email shortly.\n\nCheck your junk folder!`
				);
				clearAllInputFields('#resetPswdPopup');
				break;
			case 400:
			case 409:
			case 429:
				displayToast(http.responseText);
				break;
			case 500:
			case 502:
				displayToast('Server error. Try again later.');
				break;
			default:
				displayToast('Something went wrong. Status code: ' + http.status);
		}
	}});
});

let notesModule;
function setUpMainPage() {
	setLoggedIn();
	function refreshPageInfo(uploadedCount=0) {
		sendHttpRequest('GET', '/files', {}, { load: (http) => {
			switch (http.status) {
				case 200:
					fillMainPage(JSON.parse(http.responseText), uploadedCount);
					break;
				default:
					displayToast('Something went wrong. Status code: ' + http.status);
			}
		}});
	}

	refreshPageInfo();

	if (!isInviteSession()) {
		import('./notes.mjs')
			.then(notes => {
				notes.getNotes();
				notesModule = notes;
			})
			.catch(err => {
				displayToast('Failed to get notes script.');
				console.error(err);
			});
	}

	async function mainUploadFiles(files) {
		if (files.length === 0) return;

		const formData = new FormData();

		let totalSize = 0;
		for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
			totalSize += files[i].size;
   		 }

		if (usedSpace + totalSize > totalSpace) {
			displayToast(`You don't have enough space for that.\nYou would need an extra ${getFormattedSize(usedSpace + totalSize - totalSpace)} of space.`);
			return;
		}

		const filePickerDropAreaLabel = $('#filePickerDropAreaLabel'),
		      formerFilePickerDropAreaLabelText = filePickerDropAreaLabel.textContent,
		      filePickerDropArea = $('#filePickerDropArea'),
		      filePicker = $('#filePicker');

		const options = {
			body: formData
		}

		filePickerDropArea.classList.add('inProgressFilePickerDropArea');
		filePicker.classList.add('inProgressFilePicker');
		filePicker.disabled = true;

		const beforeUnloadFuncUpload = (e) => {
			e.returnValue = ''; // for chrome
			return ''; // for firefox
		}

		window.addEventListener('beforeunload', beforeUnloadFuncUpload);
	
		const afterUploadCleanupFunc = () => {
			window.removeEventListener('beforeunload', beforeUnloadFuncUpload);
			filePickerDropAreaLabel.textContent = formerFilePickerDropAreaLabelText;
			filePickerDropArea.classList.remove('inProgressFilePickerDropArea');
			filePicker.classList.remove('inProgressFilePicker');
			filePicker.disabled = false;
			filePickerDropArea.style.background = '';
		};

		sendHttpRequest('POST', '/upload', options, { 
			load: (http) => {
				afterUploadCleanupFunc();
				switch (http.status) {
					case 200:
						refreshPageInfo(files.length);
						if (files.length > 1) {
							var msg = `Uploaded ${files.length} files`;
						} else {
							var msg = 'Uploaded ' + files[0].name;
						}
						displayToast(msg, { type: 'alert' });
						break;
					case 413:
						displayToast(`You don't have enough free space for that`);
						break;
					default:
						displayToast('Something went wrong. Status code: ' + http.status);
				}
			},
			error: (e) => {
				afterUploadCleanupFunc();
				alert('The upload failed, maybe the connection timed out or the server crashed.\n\nTry again.');
			},
			progress: (e) => {
				const percent = Math.floor(100 * e.loaded / e.total);
				filePickerDropAreaLabel.textContent = getFormattedSize(e.loaded) + ' / ' + getFormattedSize(e.total) + '\r\n' + percent + '%';
				filePickerDropArea.style.background = 'linear-gradient(90deg, var(--oddFilesBackgroundColor) ' + percent + '%, rgba(0,0,0,0)' + percent + '%)';
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

	let shiftKeyDown = false; // if true, user will not be warned when deleting

	function fillMainPage(filesInfo, uploadedCount=0) {
		usedSpace = filesInfo.usedSpace;
		totalSpace = filesInfo.totalSpace;

		const storageBarLabel = $('#storageBarLabel');
		storageBarLabel.textContent = getFormattedSize(usedSpace) + " used / " + getFormattedSize(totalSpace) + ' total';
		storageBarLabel.title = usedSpace + ' B / ' + totalSpace + ' B';

		let usedSpacePercent = (usedSpace / totalSpace * 100).toFixed(1); // Percent with 1 decimal space
		if (usedSpacePercent < 1 && usedSpace > 0) {
			usedSpacePercent = 0.05;
		} else if (usedSpacePercent > 100) {
			usedSpacePercent = 100;
		}

		setTimeout(() => {
			$('#storageBarUsed').style.width = usedSpacePercent + '%';
	 	}, 10);

		const filesList = $('#filesList');
		const files = filesInfo.files;

		if (files.length > 0)
			filesList.innerHTML = ''; // Removes the default list item
		else
		 	filesList.innerHTML = `<li class="filesListItem"><span class="filesListItemComponentLeft">Looks like there's nothing here. Hmm...</span></li>`;

		for (let i = 0; i < files.length; i++) {
			const filesListItem = document.createElement('li');
			filesListItem.classList.add('filesListItem');
			if (i < uploadedCount) {
				filesListItem.onanimationend = () => {
					filesListItem.classList.remove('fileListItemNew');
				};
				filesListItem.classList.add('fileListItemNew');
			}

			let filename = document.createElement('span');
			filename.classList.add('filesListItemComponentLeft');
			filename.textContent = files[i].baseName.length > 40 ? files[i].name.substring(0, 40) + '..' + files[i].ext : files[i].baseName;
			filename.title = files[i].baseName;

			let size = document.createElement('span');
			size.classList.add('filesListItemTextComponent');
			size.textContent = getFormattedSize(files[i].size);
			size.title = files[i].size + ' B';
			
			let date = document.createElement('span');
			date.classList.add('filesListItemTextComponent');
			const d = new Date(files[i].uploadDate);
			date.textContent = getRelativeTime(d, new Date());
			date.title = getUtcOffsetTime(d);
			
			let deleteButton = document.createElement('span');
			deleteButton.classList.add('icon', 'deleteIcon');
			deleteButton.title = 'Delete';
			deleteButton.addEventListener('click', () => {

				if (!shiftKeyDown && !confirm('Are you sure you want to delete ' + files[i].baseName + '?')) {
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

				sendHttpRequest('DELETE', '/delete', options, { load: (http) => {
					switch (http.status) {
						case 204:
							refreshPageInfo();
							displayToast(`Deleted ${files[i].baseName}`, { type: 'alert' });
							break;
						default:
							displayToast('Something went wrong. Status code: ' + http.status);
					}
				}});
			});

			filesListItem.append(filename, size, date, deleteButton);

			if (!isInviteSession()) {
				let shareButton = document.createElement('span');
				shareButton.classList.add('icon', 'shareIcon');
				shareButton.title = 'Share';
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
			
						sendHttpRequest('POST', '/share', options, { load: (http) => {
							switch (http.status) {
								case 201:
									const url = JSON.parse(http.responseText).url;
									copyToClipboard(url);
									$('#shareLinkField').value = url;
									break;
								default:
									displayToast('Something went wrong. Status code: ' + http.status);
							}
						}});
					});
				});
	
	
				let downloadButton = document.createElement('span');
				downloadButton.classList.add('icon', 'downloadIcon');
				downloadButton.title = 'Download';
				downloadButton.addEventListener('click', () => {
					downloadButton.className = 'loadingIcon';
	
					const options = {
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							baseName: files[i].baseName
						})
					};
	
					sendHttpRequest('POST', '/download/request', options, { load: async (http) => {
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
								displayToast('Something went wrong. Status code: ' + http.status);
						}
					}});
				});
				filesListItem.append(shareButton, downloadButton);
			}
			filesList.appendChild(filesListItem);
		}
	}

	if (!isInviteSession()) {
		let refreshButton = $('#refreshButton');
		refreshButton.addEventListener('click', async () => {
			refreshPageInfo();
			refreshButton.classList.add('rotatingRefresh');
			await sleep(1000);
			refreshButton.classList.remove('rotatingRefresh');
		});

		let logoutButton = $('#logoutButton');
		logoutButton.addEventListener('click', logout);

		registerXButtons();

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
			const shareLinkField = $('#shareLinkField');
			shareLinkField.style.display = 'none';
			shareLinkField.value = '';
			document.documentElement.style.overflow = '';
			const createShareLinkBtn = $('#createShareLinkBtn');
			createShareLinkBtn.outerHTML = createShareLinkBtn.outerHTML; // remove all event listeners
			const createInviteLinkBtn = $('#createInviteLinkBtn');
			createInviteLinkBtn.outerHTML = createInviteLinkBtn.outerHTML; // remove all event listeners

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
	
				sendHttpRequest('POST', '/invite', options, { load: (http) => {
					switch (http.status) {
						case 201:
							const url = JSON.parse(http.responseText).url;
							copyToClipboard(url);
							$('#inviteLinkField').value = url;
							break;
						case 413:
							displayToast(`You don't have enough free space for that`);
							break;
						default:
							displayToast('Something went wrong. Status code: ' + http.status);
					}
				}});
			});
		});

		// Makes the complaintField expand to accommodate its input text.
		$('#inviteMessageField').addEventListener('input', dynamicTextArea);
	}

	// register paste listener to upload files using CTRL+V
	let pastedRecently = false;
	document.addEventListener('paste', async (event) => {
		// Don't want users spam-pasting or accidently double-pasting
		if (pastedRecently) return;

		const items = (event.clipboardData || event.originalEvent.clipboardData).items;
		if (!items) return;

		const fileList = [];

		// Iterate through all the items in the clipboard, find the files, and put them into the fileList array
		for (let index in items) {
			const item = items[index];
			if (item && item.kind === 'file') {
				fileList.push(item.getAsFile());
			}
		}

		if(fileList.length > 0) {
			mainUploadFiles(fileList);
		} else {
			displayToast('No files found in the clipboard', { type: 'error' });
		}

		// Set a 1.5 second timeout before the user can paste again
		pastedRecently = true;
		await sleep(1500);
		pastedRecently = false;
	});

	document.addEventListener('keydown', (event) => shiftKeyDown = event.shiftKey);
	document.addEventListener('keyup', (event) => shiftKeyDown = event.shiftKey);
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

	// Uploading using drag 'n' drop
	filePickerDropArea.addEventListener('drop', e => {
		if (!filePicker.disabled)
			uploadFilesFunction(e.dataTransfer.files);
	}, false);

	// Uploading using file explorer
	filePicker.addEventListener('change', function(e) {
		if (this.files.length > 0) {
			uploadFilesFunction(this.files);
		}
	});
}

// Check for params after DOM loads
document.addEventListener('DOMContentLoaded', (e) => {
	const urlParams = new URLSearchParams(window.location.search);
	const inviteCode = urlParams.get('invite');
	if (inviteCode) {
		sendHttpRequest('GET', '/invite?id=' + inviteCode, {}, { load: (http) => {
			switch (http.status) {
				case 200:
					setInviteAccessToken(http.getResponseHeader("Invite-Access-Token"));
					app.innerHTML = http.responseText;
					setUpMainPage();
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

			displayToast(alertMessage, {type: 'alert'});
			// Remove query string from URL so that the error alert doesn't show again on refresh
			window.history.pushState({}, '', window.location.origin);
			showLoginForm();
		}});
		return;
	}

	const signoutReason = urlParams.get('signout');
	if (signoutReason) {
		window.history.pushState({}, '', window.location.origin); // remove query params
		const options = { type: 'alert', timeout: 6000 }
		switch (signoutReason) {
			case 'user':
				displayToast('Successfully signed out', options);
				break;
			case 'user_expired':
				displayToast(`Logged you out. Your session was expired anyway.`, options);
				break;
			case 'server':
				displayToast(`Your session expired and could not be refreshed. Please try signing in again.`, options);
				break;
			case 'resetpassword':
				displayToast('Your password was reset. Try signing in.', options);
				break;
		}
		showLoginForm();
		return;
	}

	const usernameParam = urlParams.get('u');
	const passwordParam = urlParams.get('p');
	if (usernameParam && passwordParam) {
		window.history.pushState({}, '', window.location.origin); // remove query params
		displayToast('Attempting autologin with URL parameters...', { type: 'alert', timeout: 4000 });
		login(usernameParam, passwordParam, false, (wasLoginSuccessful) => {
			if (!wasLoginSuccessful)
				showLoginForm();
		});
		return;
	}

	if (location.pathname === '/') { // try to login with cookies
		sendHttpRequest('GET', '/login/access', {}, { load: (http) => {
			switch (http.status) {
				case 200:
					app.innerHTML = http.responseText;
					setUpMainPage();
					return;
				default:
					console.info('Unable to log in with cookies (if there are any)');
			}
			showLoginForm();
		}});
	}
});

function showLoginForm() {
	$('#loginCard').style.display = 'block';
}

async function copyToClipboard(text) {
	navigator.clipboard.writeText(text)
		.then(() => {
			displayToast('\uD83D\uDCCB\xa0\xa0Copied to clipboard', {type: 'alert'});
		})
		.catch(() => {
			displayToast('Failed to copy to clipboard. Copy the link manually.');
		});
}

$('#signupMsgField').addEventListener('input', dynamicTextArea);