
/*
  verified-badge.js
  A self-contained JavaScript helper for collecting Facebook Page verification requests.
  Features:
  - Renders a verification request form into a target container
  - Client-side validation (required fields, URL check, email)
  - Honeypot anti-spam field
  - Generates a ready-made email template you can copy
  - Submits JSON via fetch to a configurable endpoint
  - Lightweight, no frameworks required
  Usage:
    1. Include this script on your page.
    2. Add a container element with id="verified-badge-container".
    3. Call initVerifiedBadge({ endpoint: '/api/verify', containerId: 'verified-badge-container' })
*/

(function (global) {
  'use strict';

  const defaults = {
    endpoint: 'https://example.com/verify-request', // change to your real backend endpoint
    containerId: 'verified-badge-container',
    submitText: 'Request Verification',
    successMessage: 'Request submitted — we will review and contact you.',
    errorMessage: 'There was a problem submitting your request. Please try again later.',
    requireFile: false, // set true if you want file upload support
  };

  // Small helper utilities
  function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function isValidEmail(email) {
    // conservative email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidURL(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function showMessage(container, text, isError = false) {
    let msg = container.querySelector('.vb-message');
    if (!msg) {
      msg = el('<div class="vb-message" style="margin-top:10px;"></div>');
      container.appendChild(msg);
    }
    msg.textContent = text;
    msg.style.color = isError ? 'crimson' : 'green';
  }

  // Create the form HTML
  function buildForm(config) {
    const html = `
      <div class="vb-card" style="border:1px solid #ddd;padding:16px;border-radius:8px;max-width:720px;">
        <h3 style="margin-top:0">Request Verified Badge for Facebook Page</h3>

        <label style="display:block;margin-top:8px">
          Page name (as shown on Facebook) *
          <input name="pageName" required style="width:100%;padding:8px;margin-top:4px" />
        </label>

        <label style="display:block;margin-top:8px">
          Page URL (full) *
          <input name="pageUrl" placeholder="https://www.facebook.com/YourPage" required style="width:100%;padding:8px;margin-top:4px" />
        </label>

        <label style="display:block;margin-top:8px">
          Contact email *
          <input name="contactEmail" type="email" required style="width:100%;padding:8px;margin-top:4px" />
        </label>

        <label style="display:block;margin-top:8px">
          Meta Business ID (optional)
          <input name="metaBusinessId" placeholder="e.g. 123456789" style="width:100%;padding:8px;margin-top:4px" />
        </label>

        <label style="display:block;margin-top:8px">
          Short description or reason (why you should be verified)
          <textarea name="reason" rows="3" style="width:100%;padding:8px;margin-top:4px"></textarea>
        </label>

        ${config.requireFile ? `
        <label style="display:block;margin-top:8px">
          Attach supporting document (optional)
          <input name="supportFile" type="file" style="display:block;margin-top:4px" />
        </label>` : ''}

        <!-- Honeypot field (hidden from users, visible to bots) -->
        <input name="hp_fullname" style="display:none" tabindex="-1" autocomplete="off" />

        <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
          <button type="submit" class="vb-submit" style="padding:8px 12px;border-radius:6px;border:0;background:#1877f2;color:white;cursor:pointer">
            ${config.submitText}
          </button>
          <button type="button" class="vb-generate-email" style="padding:8px 12px;border-radius:6px;border:1px solid #777;background:white;cursor:pointer">
            Copy Email Template
          </button>
        </div>

        <div class="vb-email-template" style="display:none;margin-top:12px;padding:10px;background:#f8f8f8;border-radius:6px;border:1px dashed #ddd;white-space:pre-wrap;font-family:monospace;font-size:13px"></div>
      </div>
    `;
    return el(html);
  }

  // generate a short professional email template
  function generateEmailTemplate(form) {
    const pageName = form.pageName.value.trim();
    const pageUrl = form.pageUrl.value.trim();
    const contactEmail = form.contactEmail.value.trim();
    const metaId = form.metaBusinessId ? form.metaBusinessId.value.trim() : '';
    const reason = form.reason ? form.reason.value.trim() : '';

    return [
`Subject: Request for Verified Badge — ${pageName}`,
`To: support@facebook.com (or your account manager)`,
``,
`Hello Facebook Support Team,`,
``,
`I am writing on behalf of the Facebook Page "${pageName}". We would like to request a Verified Badge for the Page to confirm its authenticity and help our audience find us more easily.`,
``,
`Page URL: ${pageUrl}`,
`Contact email: ${contactEmail}`,
`Meta Business ID: ${metaId || '(not provided)'}`,
``,
`Why verification is needed:`,
`${reason || '- We represent a recognized brand and want to protect our audience from impersonation.'}`,
``,
`Attached are supporting documents (if any). Please let me know if you need additional verification or documentation.`,
``,
`Thank you and best regards,`,
`[Your full name]`,
`[Your role — e.g., Page Admin]`,
`[Phone number — optional]`
    ].join('\n');
  }

  // Basic validation; returns {ok: boolean, errors: []}
  function validateForm(form, config) {
    const errors = [];
    if (form.hp_fullname && form.hp_fullname.value.trim() !== '') {
      errors.push('Spam detected.');
    }
    if (!form.pageName.value.trim()) errors.push('Page name is required.');
    if (!isValidURL(form.pageUrl.value.trim())) errors.push('Page URL is invalid.');
    if (!isValidEmail(form.contactEmail.value.trim())) errors.push('Contact email is invalid.');
    if (config.requireFile && form.supportFile && form.supportFile.files && form.supportFile.files.length === 0) {
      // if required file
      // errors.push('Supporting document is required.');
    }
    return { ok: errors.length === 0, errors };
  }

  // Submit handler (sends JSON; file upload not implemented here to keep code simple)
  async function submitRequest(form, config, container) {
    const data = {
      pageName: form.pageName.value.trim(),
      pageUrl: form.pageUrl.value.trim(),
      contactEmail: form.contactEmail.value.trim(),
      metaBusinessId: form.metaBusinessId ? form.metaBusinessId.value.trim() : '',
      reason: form.reason ? form.reason.value.trim() : '',
      submittedAt: new Date().toISOString(),
    };

    // If you need to upload files, swap to FormData() server-side handling
    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const text = await res.text().catch(()=>null);
        throw new Error(text || 'Non-OK response');
      }

      showMessage(container, config.successMessage, false);
      return true;
    } catch (err) {
      console.error('Verified badge submit error:', err);
      showMessage(container, config.errorMessage, true);
      return false;
    }
  }

  // Public initializer
  function initVerifiedBadge(options = {}) {
    const config = Object.assign({}, defaults, options || {});
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error('Verified Badge: container element not found:', config.containerId);
      return;
    }

    // build and mount form
    const formCard = buildForm(config);
    container.appendChild(formCard);

    const submitBtn = formCard.querySelector('.vb-submit');
    const emailBtn = formCard.querySelector('.vb-generate-email');
    const emailTpl = formCard.querySelector('.vb-email-template');

    // attach submit behavior
    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      // gather inputs
      const fakeForm = {
        pageName: formCard.querySelector('input[name="pageName"]'),
        pageUrl: formCard.querySelector('input[name="pageUrl"]'),
        contactEmail: formCard.querySelector('input[name="contactEmail"]'),
        metaBusinessId: formCard.querySelector('input[name="metaBusinessId"]'),
        reason: formCard.querySelector('textarea[name="reason"]'),
        hp_fullname: formCard.querySelector('input[name="hp_fullname"]'),
        supportFile: formCard.querySelector('input[name="supportFile"]'),
      };

      const v = validateForm(fakeForm, config);
      if (!v.ok) {
        showMessage(container, v.errors.join(' '), true);
        return;
      }

      // disable UI while submitting
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      await submitRequest(fakeForm, config, container);

      submitBtn.disabled = false;
      submitBtn.textContent = config.submitText;
    });

    // generate/copy email template
    emailBtn.addEventListener('click', function () {
      const fakeForm = {
        pageName: formCard.querySelector('input[name="pageName"]'),
        pageUrl: formCard.querySelector('input[name="pageUrl"]'),
        contactEmail: formCard.querySelector('input[name="contactEmail"]'),
        metaBusinessId: formCard.querySelector('input[name="metaBusinessId"]'),
        reason: formCard.querySelector('textarea[name="reason"]'),
      };
      const tpl = generateEmailTemplate(fakeForm);
      emailTpl.textContent = tpl;
      emailTpl.style.display = 'block';

      // try copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tpl).then(() => {
          showMessage(container, 'Email template copied to clipboard — paste into your email client.', false);
        }).catch(() => {
          showMessage(container, 'Email template shown below. Copy manually if clipboard is blocked.', false);
        });
      } else {
        showMessage(container, 'Email template shown below. Copy manually if clipboard is blocked.', false);
      }
    });

    return {
      config,
      container,
      destroy() {
        container.removeChild(formCard);
      }
    };
  }

  // Export to global
  global.initVerifiedBadge = initVerifiedBadge;

})(window);
