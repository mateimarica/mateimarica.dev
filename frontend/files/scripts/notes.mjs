import { sendHttpRequest } from './req-manager.mjs';
import { dynamicTextArea, sleep, getRelativeTime, getUtcOffsetTime } from './util.mjs';

const $ = document.querySelector.bind(document);
const notesArea = $('#notesArea'), notesDate = $('#notesDate'), notesCharCount = $('#notesCharCount'), notesStatus = $('#notesStatus');
notesArea.onanimationend = () => notesArea.classList.remove('syncedNotesArea');
const nonEditInputEvent = new Event('input');
const loadingAnimation = ['/', '—', '\\', '|'];
const MAX_FAILED_RETRIES = 5;
let notesMaxLength, lastEditTime, saving = false, saveSuccessful = true, pollerId, unsavedChanges = false, currentPoll = null, lastDataId = null;
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

	if (syncSuccessful) {
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
	unsavedChanges = true;
	notesStatus.textContent = '\xa0'; // set it to &nbsp; so the container doesn't collapse
	lastEditTime = new Date();

	let milli = 750;
	await sleep(milli);
	if (new Date() - lastEditTime < milli) return;
	updateNotes();
});

async function updateNotes(callback=null) {
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
		load: async (http) => {
			switch (http.status) {
				case 204:
					window.removeEventListener('beforeunload', beforeUnloadFuncNotes);
					unsavedChanges = false;
					saveSuccessful = true;
					saving = false;
					notesDate.textContent = 'Edited just now';
					notesDate.title = getUtcOffsetTime(new Date());
					callback && callback();
					break;
				default:
					console.error(`Couldn't save your notes :( Status code: ${http.status}\nTrying again in 15 seconds...`);
					saveSuccessful = false;
					saving = false;
					await sleep(15000);
					updateNotes();
			}
		},
		error: async () => {
			saveSuccessful = false;
			saving = false;
			console.error(`Couldn't save your notes! Trying again in 3 seconds...`);
			await sleep(3000);
			updateNotes();
		}
	});
}

notesArea.addEventListener('keydown', function(event) {
	if(event.keyCode === 9) {
		event.preventDefault();
		const v = this.value, s = this.selectionStart, e = this.selectionEnd;
		this.value = v.substring(0, s) + '\t' + v.substring(e);
		this.selectionStart = this.selectionEnd = s + 1;
	}
});
notesArea.addEventListener('paste', (e) => e.stopPropagation()); // prevent paste event from bubbling up to document

async function getNotes(isPoll=false) {
	sendHttpRequest('GET', '/notes', {}, getNotesCallback(isPoll));
}

async function pollNotes() {
	const options = {
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({
			pollerId: pollerId,
			...lastDataId && { lastDataId: lastDataId }
		})
	}

	// If there already is a polling request, abort it so we don't end up with multiple
	if (currentPoll) {
		currentPoll.abort();
		currentPoll = null;
	}

	sendHttpRequest('POST', '/poll', options, getNotesCallback(true));
}

function getNotesCallback(isPoll=false) {
	return {
		created: (http) => {
			if (isPoll) currentPoll = http; // save the http object
		},
		load: async (http) => {
			switch (http.status) {
				case 200:
					notesStatusSyncingAnimation(true);
					const notes = JSON.parse(http.responseText);
					notesArea.value = notes.notes;

					if (isPoll) {
						notesStatus.textContent = '\xa0';
						notesDate.textContent = 'Edited just now';
						notesDate.title = getUtcOffsetTime(new Date());
						notesArea.classList.add('syncedNotesArea');
						lastDataId = notes.lastDataId;
					} else {
						const lastEditDate = new Date(notes.lastEdit);
						notesDate.textContent = notes.lastEdit ? 'Edited ' + getRelativeTime(lastEditDate, new Date()) : '';
						notesDate.title = getUtcOffsetTime(lastEditDate);
						notesMaxLength = notes.textMaxLength;
						notesArea.setAttribute('maxlength', notesMaxLength);
						pollerId = notes.pollerId;
					}

					notesArea.dispatchEvent(nonEditInputEvent);

					pollNotes();
					break;
				case 408: // on timeout, retry after 1 second
					if (isPoll) {
						notesStatusSyncingAnimation(false);
						console.error('Failed to sync notes. Trying again in 3 seconds...');
						await sleep(3000);
						pollNotes();
						if (!unsavedChanges) getNotes();
						break;
					}
					// if not poll, go to default vv
				default:
					notesStatusSyncingAnimation(false);
					console.error(`Failed to sync notes. Status code: ` + http.status + `\nTrying again in 3 seconds.`);
					await sleep(3000);
					
			}
		},
		error: async (e) => {
			if (isPoll && !navigator.onLine) return; // wait for online event instead

			console.error('Failed to sync notes. Trying again in 3 seconds...');
			await sleep(3000);
			isPoll ? pollNotes() : getNotes();
		}
	};
}

// recalculate textarea height upon window resize
window.addEventListener('resize', () => notesArea.dispatchEvent(nonEditInputEvent));
window.addEventListener('online', () => {
	if (unsavedChanges) {
		updateNotes(() => pollNotes()); // update, then poll because
	} else {
		pollNotes();
	}
});

window.addEventListener('offline', () => {
	if (currentPoll) {
		currentPoll.abort();
		currentPoll = null;
	}
});

export { getNotes };