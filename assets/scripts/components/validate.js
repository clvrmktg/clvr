// validate.js
document.addEventListener('DOMContentLoaded', function () {
  // Initialize Bouncer for all forms marked with data-validate
  const selector = '[data-validate]';
  const bouncer = new Bouncer(selector, {
    disableSubmit: true, // prevent native submit when invalid
    emitEvents: true,    // fire custom events we can hook into
    // You can style these if you want:
    // fieldClass: 'is-dirty',
    // errorClass: 'is-error',
    // messageAfterField: true,
  });

  const forms = document.querySelectorAll(selector);
  if (!forms.length) return;

  forms.forEach((form) => {
    const submitBtn = form.querySelector('button[type="submit"]');
    const live = document.getElementById('form-errors');

    // --- Helpers -------------------------------------------------------------

    // Trim all text-like fields (avoid false negatives from stray spaces)
    function trimFields(frm) {
      frm.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea')
        .forEach((el) => { if (el.value) el.value = el.value.trim(); });
    }

    // Announce messages to screen readers (if live region exists)
    function announce(msg) {
      if (!live) return;
      // Clear first to retrigger announcement in some SRs
      live.textContent = '';
      // Small timeout helps VoiceOver/NVDA re-announce
      setTimeout(() => { live.textContent = msg; }, 0);
    }

    // Focus first field that Bouncer/HTML marked invalid
    function focusFirstInvalid(frm) {
      const firstInvalid = frm.querySelector('[aria-invalid="true"], .error, :invalid');
      if (firstInvalid && typeof firstInvalid.focus === 'function') {
        firstInvalid.focus();
      }
    }

    // Disable/enable submit button to prevent double clicks
    function setSubmitting(state) {
      if (!submitBtn) return;
      if (state) {
        submitBtn.setAttribute('disabled', 'disabled');
        submitBtn.setAttribute('aria-busy', 'true');
      } else {
        submitBtn.removeAttribute('disabled');
        submitBtn.removeAttribute('aria-busy');
      }
    }

    // Get the best available error message near a field
    function getFieldErrorMessage(field) {
      // Prefer Bouncer’s injected message element if present
      const msgEl = field.closest('.form__field')?.querySelector('.error-message');
      if (msgEl && msgEl.textContent) return msgEl.textContent.trim();
      // Fall back to native validation message
      return field.validationMessage || 'Please correct the highlighted field.';
    }

    // --- Event wiring --------------------------------------------------------

    // Clear stale announcements as user edits
    form.addEventListener('input', () => announce(''));
    form.addEventListener('blur', () => announce(''), true);

    // Valid form according to constraints + Bouncer
    form.addEventListener('bouncerFormValid', function (e) {
      trimFields(form);

      // If Netlify reCAPTCHA is on the form, Netlify takes over the submit flow.
      // Do NOT programmatically submit, or you’ll bypass the challenge.
      if (form.querySelector('[data-netlify-recaptcha]')) {
        // Let the natural submit proceed (button click or Enter key)
        return;
      }

      // No reCAPTCHA: safe to submit programmatically
      form.submit();
    });

    // Invalid form: announce and focus first problem
    form.addEventListener('bouncerFormInvalid', function () {
      // Focus first invalid input for quick correction
      focusFirstInvalid(form);

      // Announce the first error message
      const field = form.querySelector('[aria-invalid="true"], :invalid');
      if (field) {
        announce(getFieldErrorMessage(field));
      } else {
        announce('Please review the highlighted fields.');
      }

      // Re-enable the button if we disabled it during submit
      setSubmitting(false);
    });

    // Guard against double clicks; re-enable if browser cancels submit
    form.addEventListener('submit', function (evt) {
      setSubmitting(true);

      // If invalid, prevent submit and re-enable button
      if (!form.checkValidity()) {
        evt.preventDefault();
        setSubmitting(false);
        // Bouncer will fire bouncerFormInvalid, which will handle focus + announce
      }
      // If valid, either:
      // - Netlify reCAPTCHA is present → natural submit continues (Netlify handles)
      // - No reCAPTCHA → bouncerFormValid handler will programmatically submit
    });
  });
});
