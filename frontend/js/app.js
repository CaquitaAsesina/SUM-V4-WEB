/* ============================================
   CARLOS MORI - JAVASCRIPT PRINCIPAL
   ============================================ */

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
    };

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="bi ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// CONFIRM MODAL ÚNICO Y RESPONSIVO
// ============================================

function openConfirm(options = {}) {
    const modalEl = document.getElementById('confirmModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    const icon = document.getElementById('confirmIcon');
    const title = document.getElementById('confirmTitle');
    const text = document.getElementById('confirmText');
    const acceptBtn = document.getElementById('btnConfirmAccept');

    icon.innerHTML = `<i class="bi ${options.icon || 'bi-exclamation-triangle-fill'} ${options.iconClass || 'text-warning'}"></i>`;
    title.textContent = options.title || '¿Confirmar acción?';
    text.textContent = options.message || 'Esta acción no se puede deshacer.';
    acceptBtn.className = `btn ${options.acceptClass || 'btn-danger'} btn-sm`;
    acceptBtn.innerHTML = (options.acceptIcon ? `<i class="bi ${options.acceptIcon} me-1"></i>` : '') + `<span>${options.acceptText || 'Aceptar'}</span>`;

    acceptBtn.onclick = async () => {
        modal.hide();
        if (typeof options.onConfirm === 'function') {
            try {
                await options.onConfirm();
            } catch (e) {
                if (typeof showToast === 'function') showToast('Error de conexión', 'error');
            }
        }
    };

    modal.show();
}

// ============================================
// TYPING EFFECT
// ============================================

function typeWriter(elementId, phrases, typeSpeed = 80, deleteSpeed = 60, pauseTime = 2000) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentPhrase = phrases[phraseIndex];

        if (isDeleting) {
            el.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            el.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }

        let timeout = isDeleting ? deleteSpeed : typeSpeed;

        if (!isDeleting && charIndex === currentPhrase.length) {
            timeout = pauseTime;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            timeout = 400;
        }

        setTimeout(type, timeout);
    }

    type();
}

// ============================================
// SCROLL REVEAL (IntersectionObserver)
// ============================================

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-reveal').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
}

// ============================================
// COUNT UP ANIMATION
// ============================================

function countUp(element, target, duration = 1000) {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start);
        }
    }, 16);
}

// ============================================
// INIT ON LOAD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
});
