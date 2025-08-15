
var bouncer = new Bouncer('[data-validate]', {
	disableSubmit: true  // Prevent submission until validation passes
});

// Manually trigger validation
console.log('Before validation');
bouncer.validate();  // Manually trigger form validation for testing

// Check if the form is valid
if (bouncer.isValid()) {
	console.log('Form is valid');
} else {
	console.log('Form is invalid');
}

// Listen for validation events
document.addEventListener('bouncerFormValid', function () {
	console.log('bouncerFormValid event fired');
	console.log('Form is valid, submitting...');
	var form = document.querySelector('[data-validate]');
	form.submit();  // Submit the form after validation
}, false);

document.addEventListener('bouncerFormInvalid', function () {
	console.log('bouncerFormInvalid event fired');
	console.log('Form is invalid');
}, false);
