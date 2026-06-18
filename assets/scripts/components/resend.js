const form = document.getElementById('contact') || document.getElementById('contact-form');

if (form) {
  form.addEventListener('submit', async () => {
    // Clone values before Netlify eats the event
    const formData = new FormData(form);
    const data = {
      first_name: formData.get('first_name') || '',
      last_name: formData.get('last_name') || '',
      business: formData.get('business') || '',
      current_website: formData.get('current_website') || '',
      email: formData.get('email') || '',
      phone: formData.get('phone') || '',
      help_with: formData.get('help_with') || '',
      message: formData.get('message') || '',
      newsletter: formData.has('newsletter'),
      site: formData.get('site') || window.location.href,
    };

    // Fire-and-forget — don't block Netlify submission
    fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    // Let Netlify handle the rest (form capture, redirect, etc.)
  });
}
