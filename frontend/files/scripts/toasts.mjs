import { sleep } from './util.mjs';

const $ = document.querySelector.bind(document),
      notification = $('#notification'),
      notificationTimeout = 4000,
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

export { displayToast };