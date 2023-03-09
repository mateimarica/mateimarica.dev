const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

let accessToken = null,
    refreshToken = null,
    inviteAccessToken = null,
    loggedIn = false, // general boolean for being logged info, regardless of persistency of session
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
      usernameField = $('#usernameField'),
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

	if (!username) {
		return displayToast('Must enter a username');
	} else if (!password) {
		return displayToast('Must enter a password');
	}

	const arrowIcon = submitBtn.querySelector('.arrowIcon');
	arrowIcon.classList.add('rotatingLogin');

	const persistentSession = $('#stayLoggedInCheckbox').checked; // boolean

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
					accessToken  = http.getResponseHeader("Access-Token");
					refreshToken = http.getResponseHeader("Refresh-Token");
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

		// End the rotation animation at the end of an iteration so it doesn't jump
		arrowIcon.onanimationiteration = () => {
			arrowIcon.classList.remove('rotatingLogin');
		};
	}});

	passwordField.value = '';
});

const darkOverlay = $('#darkOverlay');

$('#signupLink').addEventListener('click', () => {
	showDarkOverlayForPopup();
	$('#signupPopup').style.display = 'block';
});

const dynamicTextArea = async function() {
	let y = window.scrollY; // record last scroll position
	this.style.height = "";
	this.style.height = this.scrollHeight + "px";
	window.scrollTo(0, y); // jump to last scroll position
};

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

registerXButtons();
function registerXButtons() {
	$$('.xButton').forEach(xButton => {
		xButton.addEventListener('click', function() {
			darkOverlay.style.display = 'none';
			this.parentElement.style.display = 'none';
			document.documentElement.style.overflow = ''; // add scrolling back in after popup disables it
		});
	});
}

$('#signupRequestBtn').addEventListener('click', () => {
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
		accessToken = null, refreshToken = null;
		switch (http.status) {
			case 201:
				displayToast(`Your account request was created. ${email ? 'You will recieve an email when your account is activated.' : ''}`, {type: 'alert', timeout: 8000});
				const signupPopup = $('#signupPopup');
				signupPopup.querySelector('.xButton').click();
				signupPopup.querySelectorAll('input').forEach((e) => {
					e.value = '';
				});
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

function logout() {
	let options = {};
	if (refreshToken) {
		options = {headers: {'Refresh-Token': refreshToken}};
	}
	sendHttpRequest('DELETE', '/login/refresh', options, { load: (http) => {
		accessToken = null, refreshToken = null;
		switch (http.status) {
			case 204:
				window.location.search += '&signout=user';
				break;
			case 401: // log out even if session not valid
				window.location.search += '&signout=user_expired';
				break;
			case 500:
			case 502:
				displayToast('Server error. Try again later.');
				break;
			default:
				displayToast('Something went wrong. Status code: ' + http.status);
		}
	}});
}

function setUpMainPage(isInvite=false) {
	loggedIn = true;
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
		getNotes();
	}

	refreshPageInfo();

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

			if (!isInvite) {
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

	if (!isInvite) {
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

	const notesArea = $('#notesArea'), notesDate = $('#notesDate'), notesCharCount = $('#notesCharCount'), notesStatus = $('#notesStatus');
	notesArea.onanimationend = () => notesArea.classList.remove('syncedNotesArea');
	const nonEditInputEvent = new Event('input');
	const loadingAnimation = ['/', '—', '\\', '|']
	let notesMaxLength, lastEditTime, saving = false, saveSuccessful = true, pollerId;
	dynamicTextArea.call(notesArea);

	async function notesStatusSavingAnimation() {
		const len = loadingAnimation.length;
		const frameLength = 200 / len;
		for (let i = 0; saving; i = (i+1) % len) { // i goes 0, 1, 2, 3, 0, 1, 2, 3 ... looping through the animation frames
			notesStatus.textContent = loadingAnimation[i];
			await sleep(frameLength);
		}

		if (saveSuccessful) {
			notesStatus.textContent = 'Saved';
		} else {
			notesStatus.textContent = 'Save failed';
		}
	}

	async function notesStatusSyncingAnimation(syncSuccessful) {
		const len = loadingAnimation.length;
		const frameLength = 200 / len;
		for (let i = 0; i < len; i++) { 
			notesStatus.textContent = loadingAnimation[i];
			await sleep(frameLength);
		}

		if (saveSuccessful) {
			notesStatus.textContent = 'Synced';
		} else {
			notesStatus.textContent = 'Sync failed';
		}
	}

	const beforeUnloadFuncNotes = (e) => {
		e.returnValue = ''; // for chrome
		return ''; // for firefox
	}

	notesArea.addEventListener('input', async (e) => {
		let len = notesArea.value.length;
		if (len > notesMaxLength) { // firefox allows pasting paste maxlength, so we gotta do this
			notesArea.value = notesArea.value.substring(0, notesMaxLength); // crop text
			len = notesArea.value.length; // recalculate length
		}
		dynamicTextArea.call(notesArea);
		notesCharCount.textContent = len + ' / ' + notesMaxLength;
		if (!e.inputType) return; // if no input type, means that this function was called without the need to save
		notesStatus.textContent = '\xa0'; // set it to &nbsp; so the container doesn't collapse
		lastEditTime = new Date();

		let milli = 750;
		await sleep(milli);
		if (new Date() - lastEditTime < milli) return;

		saving = true;
		notesStatusSavingAnimation();

		window.addEventListener('beforeunload', beforeUnloadFuncNotes);

		const options = {
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text: notesArea.value,
				pollerId: pollerId
			})
		};
		sendHttpRequest('PATCH', '/notes', options, {
			load: (http) => {
				switch (http.status) {
					case 204:
						window.removeEventListener('beforeunload', beforeUnloadFuncNotes);
						saveSuccessful = true;
						saving = false;
						notesDate.textContent = 'Edited just now';
						notesDate.title = getUtcOffsetTime(new Date());
						break;
					default:
						displayToast(`Couldn't save your notes :(\n Status code: ` + http.status);
				}
			},
			error: () => {
				window.removeEventListener('beforeunload', beforeUnloadFuncNotes);
				displayToast(`Couldn't save your notes!\nServer might be down...`);
				saveSuccessful = false;
				saving = false;
			}
		});
	});
	notesArea.addEventListener('keydown', function(event) {
		if(event.keyCode === 9) {
			event.preventDefault();
			const v = this.value, s = this.selectionStart, e = this.selectionEnd;
			this.value = v.substring(0, s) + '\t' + v.substring(e);
			this.selectionStart = this.selectionEnd = s + 1;
		}
	});
	notesArea.addEventListener('paste', (e) => e.stopPropagation()); // prevent paste event from bubbling up to document

	async function getNotes() {
		sendHttpRequest('GET', '/notes', {}, { load: (http) => {
			switch (http.status) {
				case 200:
					const notes = JSON.parse(http.responseText);
					notesArea.value = notes.text;
					notesMaxLength = notes.textMaxLength;
					notesArea.setAttribute('maxlength', notesMaxLength);
					notesArea.dispatchEvent(nonEditInputEvent);
					const lastEditDate = new Date(notes.lastEdit);
					notesDate.textContent = notes.lastEdit ? 'Edited ' + getRelativeTime(lastEditDate, new Date()) : '';
					notesDate.title = getUtcOffsetTime(lastEditDate);
					pollerId = notes.pollerId;
					pollNotes();
					break;
				default:
					displayToast(`Couldn't retrieve notes. Status code: ` + http.status);
			}
		}});
	}

	async function pollNotes() {
		const options = {
			headers: {'Content-Type': 'application/json'}, 
			body: JSON.stringify({
				pollerId: pollerId
			})
		}
		sendHttpRequest('POST', '/notes/poll', options, { 
			load: async (http) => {
				switch (http.status) {
					case 200:
						notesStatusSyncingAnimation(true);
						const notes = JSON.parse(http.responseText);
						notesArea.value = notes.text;
						notesArea.dispatchEvent(nonEditInputEvent);
						notesDate.textContent = 'Edited just now';
						notesDate.title = getUtcOffsetTime(new Date());
						notesStatus.textContent = '\xa0';
						notesArea.classList.add('syncedNotesArea')
						pollNotes();
						break;
					default:
						notesStatusSyncingAnimation(false);
						displayToast(`Notes polling failed. Status code: ` + http.status + `\nTrying again in 30 seconds.`);
						await sleep(30000);
						pollNotes();
				}
			},
			error: async(e) => {
				notesStatusSyncingAnimation(false);
				displayToast(`Notes polling connection failed.\nTrying again in 30 seconds.`);
				await sleep(30000);
				pollNotes();
			}
		});
	}

	// recalculate textarea height upon window resize
	window.addEventListener("resize", () => notesArea.dispatchEvent(nonEditInputEvent));

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

/** {headers: {'Content-Type': 'application/json', 'Header1':'value'}, responseType: 'type', body: 'some data'} */
function sendHttpRequest(method, url, options, callbacks) {
	const http = new XMLHttpRequest();

	for (const event in callbacks) {
		if (event === 'load') continue; // use the load event listener below instead
		if (event === 'progress') {
			http.upload.onprogress = callbacks[event]; // progress events are fired on xhr.upload
			continue;
		}
		http.addEventListener(event, callbacks[event]);
	}

	http.addEventListener('load', async (e) => { // If ready state is 4, do async callback
		if (http.status === 444) { // 444 means access token invalid, so we try refresh token
			let refreshOptions = {};
			if (refreshToken) {
				refreshOptions = {headers: {'Refresh-Token': refreshToken}};
			}
			
			sendHttpRequest('POST', '/login/refresh', refreshOptions, { load: (http2) => {
				switch (http2.status) {
					case 200:
						if (refreshToken) {
							accessToken  = http2.getResponseHeader("Access-Token");
							refreshToken = http2.getResponseHeader("Refresh-Token");
						}
						sendHttpRequest(method, url, options, callbacks);
						return;
					default:
						accessToken = null, refreshToken = null;
						if (loggedIn) {
							app.remove(); // delete the app div so sensitive info is not visible
							setTimeout(() => { // 10 milli delay so DOM can update before native alert freezes everything
								window.location.search += '&signout=server';
							}, 10);
						} else {
							callbacks.load(http2, e);
						}
				}
			}});
		} else {
			callbacks.load(http, e);
		}
	});

	http.open(method, url, true);

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

/** Example: Converts "2020-11-15T23:11:01.000Z" to "a year ago" */
function getRelativeTime(oldDate, currentDate) {

	const MINUTES_PASSED = Math.floor((Math.abs(currentDate - oldDate)) / MILLI_PER_MIN); 

	if (MINUTES_PASSED === 0)
		return 'just now';

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

function getUtcOffsetTime(date) {
	const utcOffset = date.getTimezoneOffset();
	const utcOffsetHrs = Math.floor(utcOffset / 60);
	const utcOffsetMins = utcOffset % 60;
	return `${date.toLocaleString()} UTC${utcOffset<0 ? '+' : '-'}${utcOffsetHrs}${utcOffsetMins>0 ? ':'+utcOffsetMins : ''}`;
}

const KILOBYTE = 1000,
      MEGABYTE = 1000000,
      GIGABYTE = 1000000000;

/** The parseFloat() removes trailing zeroes (eg: 1.0 -> 1) */
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
		sendHttpRequest('GET', '/invite?id=' + inviteCode, {}, { load: (http) => {
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
		}
		showLoginForm();
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

const notification = $('#notification');
const notificationTimeout = 4000,
      notificationAfterHoverTimeout = 1000;

/**
@example
{
	type: 'error' || 'alert',
	timeout: milliseconds
}
*/
async function displayToast(text, options={}) {
	options.type = options.type || 'error';
	options.timeout = options.timeout || notificationTimeout;

	const n = notification.cloneNode(true);
	n.removeAttribute('id');
	if (options.type === 'error') {
		n.classList.add('error');
		text = '\u26A0\xa0\xa0' + text;
	}
	const nText = n.querySelector('span');
	nText.textContent = text;
	notification.parentNode.insertBefore(n, notification); // Insert new notification before the default one
	await sleep(50); // Wait for DOM to update so incoming transition animates
	n.classList.add('shown');
	
	let mouseHovering = false,
	    mouseEnteredRecently = false,
	    notificationExpired = false,
	    notificationDeleted = false;

	n.addEventListener('mouseenter', async () => { 
		mouseHovering = true
		mouseEnteredRecently = true;
		await sleep(notificationAfterHoverTimeout);
		mouseEnteredRecently = false;
	});
	n.addEventListener('mouseleave', async () => {
		mouseHovering = false;
		await sleep(notificationAfterHoverTimeout);
		if (!mouseHovering && !mouseEnteredRecently && notificationExpired && !notificationDeleted) {
			notificationDeleted = true;
			clearToast(n);
		}
	});
	
	await sleep(options.timeout);
	if (!mouseHovering) {
		clearToast(n);
	} else {
		notificationExpired = true;
	}
}

async function clearToast(n) {
	n.classList.remove('shown');
	await sleep(1000);
	n.remove();
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