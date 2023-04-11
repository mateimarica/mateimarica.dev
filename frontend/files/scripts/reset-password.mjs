import { sendHttpRequest } from './req-manager.mjs';
import { displayToast } from './toasts.mjs';

// jquery-like shortcut for document-level queries
const $ = document.querySelector.bind(document),
      $$ = document.querySelectorAll.bind(document);

const resetPswdField = $('#resetPswdField'),
      resetPswdAgainField = $('#resetPswdAgainField');

$('#resetPswdBtn').addEventListener('click', () => {
	const password = resetPswdField.value,
	      passwordAgain = resetPswdAgainField.value;

	if (!password) return displayToast('Must enter a password.');
	if (!passwordAgain) return displayToast('Must enter your password again.');
	if (password !== passwordAgain) return displayToast('Passwords don\'t match');

	const options = {
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			password: passwordAgain
		})
	};
	sendHttpRequest('PATCH', '/reset-password', options, { load: (http) => {
		switch (http.status) {
			case 204:
				window.location.href = '/?signout=resetpassword';
				break;
			default:
				displayToast(http.responseText);
		}
	}});
});