// main.js

document.addEventListener("DOMContentLoaded", () => {
  // ---------------- Password Toggle ----------------
  document.querySelectorAll(".icon-toggle").forEach(toggleBtn => {
    toggleBtn.addEventListener("click", () => {
      const targetId = toggleBtn.getAttribute("data-toggle-password");
      const input = document.getElementById(targetId);

      if (input.type === "password") {
        input.type = "text";
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>`;
      } else {
        input.type = "password";
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.77 21.77 0 014.06-5.94M9.88 9.88a3 3 0 104.24 4.24"/>
            <path d="M1 1l22 22"/>
          </svg>`;
      }
    });
  });

  // ---------------- Captcha ----------------
  function generateCaptcha(container) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const spanContainer = container.querySelector("[data-captcha-code]");
    spanContainer.innerHTML = "";
    [...code].forEach((char, i) => {
      const span = document.createElement("span");
      span.textContent = char;
      spanContainer.appendChild(span);
    });

    container.dataset.captchaValue = code;
  }

  document.querySelectorAll(".captcha-display").forEach(captchaBox => {
    generateCaptcha(captchaBox);

    const refreshBtn = captchaBox.querySelector("[data-captcha-refresh]");
    refreshBtn.addEventListener("click", () => {
      captchaBox.classList.add("is-spinning");
      setTimeout(() => {
        generateCaptcha(captchaBox);
        captchaBox.classList.remove("is-spinning");
      }, 400);
    });
  });

  // ---------------- Form Validation ----------------
  document.querySelectorAll("form[data-form]").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      let valid = true;

      // Reset errors
      form.querySelectorAll(".input-wrap").forEach(wrap => wrap.classList.remove("has-error"));

      // Validate required fields
      form.querySelectorAll("input[required], input[data-field], input[data-captcha-input]").forEach(input => {
        if (!input.value.trim()) {
          valid = false;
          input.closest(".input-wrap").classList.add("has-error");
        }
      });

      // Validate captcha
      const captchaInput = form.querySelector("[data-captcha-input]");
      if (captchaInput) {
        const captchaBox = form.querySelector(".captcha-display");
        const expected = captchaBox.dataset.captchaValue;
        if (captchaInput.value.trim().toUpperCase() !== expected) {
          valid = false;
          captchaInput.closest(".input-wrap").classList.add("has-error");
        }
      }

      if (valid) {
        // Show success toast
        showToast("Login successful!", "success");
        // TODO: Replace with actual backend login request
      } else {
        showToast("Please fix the errors and try again.", "error");
      }
    });
  });

  // ---------------- Toast Notifications ----------------
  function showToast(message, type = "success") {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove("toast--error", "toast--success");
    toast.classList.add(type === "error" ? "toast--error" : "toast--success", "is-visible");

    setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3000);
  }
});