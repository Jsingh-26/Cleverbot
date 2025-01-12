// Theme handling
const themeToggle = document.querySelector('.theme-toggle');
const themeOptions = document.querySelector('.theme-options');
const themeButtons = document.querySelectorAll('.theme-option');
let currentTheme = localStorage.getItem('theme') || 'system';

// Function to get system theme
function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Function to update theme toggle icon
function updateThemeToggleIcon() {
    const theme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    const icon = themeToggle.querySelector('svg');
    
    if (theme === 'dark') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else {
        icon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
    }
}

// Function to apply theme
function applyTheme(theme) {
    const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Update active state of theme buttons
    themeButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.theme === theme);
    });
    
    updateThemeToggleIcon();
}

// Toggle theme options dropdown
themeToggle.addEventListener('click', () => {
    themeOptions.classList.toggle('show');
});

// Close theme options when clicking outside
document.addEventListener('click', (e) => {
    if (!themeToggle.contains(e.target) && !themeOptions.contains(e.target)) {
        themeOptions.classList.remove('show');
    }
});

// Initialize theme
applyTheme(currentTheme);

// Add click handlers to theme options
themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const newTheme = button.dataset.theme;
        localStorage.setItem('theme', newTheme);
        currentTheme = newTheme;
        applyTheme(newTheme);
        themeOptions.classList.remove('show');
    });
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'system') {
        applyTheme('system');
    }
}); 