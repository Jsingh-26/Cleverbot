// Theme handling module
class ThemeManager {
    constructor() {
        this.themeToggle = document.querySelector('.theme-toggle');
        this.themeOptions = document.querySelector('.theme-options');
        this.themeButtons = document.querySelectorAll('.theme-option');
        this.currentTheme = localStorage.getItem('theme') || 'system';
        
        this.init();
    }

    init() {
        // Set initial theme
        this.applyTheme(this.currentTheme);
        this.updateToggleIcon();
        this.setActiveThemeButton();

        // Add event listeners
        this.themeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleThemeMenu();
        });

        document.addEventListener('click', (e) => this.handleClickOutside(e));
        
        this.themeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = button.dataset.theme;
                this.setTheme(theme);
                this.closeThemeMenu();
            });
        });

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.currentTheme === 'system') {
                this.applyTheme('system');
                this.updateToggleIcon();
            }
        });

        // Handle keyboard navigation
        this.themeToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleThemeMenu();
            }
        });

        this.themeOptions.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeThemeMenu();
                this.themeToggle.focus();
            }
        });
    }

    setTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme(theme);
        this.updateToggleIcon();
        this.setActiveThemeButton();
    }

    applyTheme(theme) {
        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.dataset.theme = systemTheme;
        } else {
            document.documentElement.dataset.theme = theme;
        }
    }

    updateToggleIcon() {
        const currentTheme = this.currentTheme === 'system' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : this.currentTheme;

        const icons = {
            light: `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>`,
            dark: `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>`
        };

        this.themeToggle.innerHTML = icons[currentTheme];
    }

    setActiveThemeButton() {
        this.themeButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.theme === this.currentTheme);
            button.setAttribute('aria-pressed', button.dataset.theme === this.currentTheme);
        });
    }

    toggleThemeMenu() {
        const isExpanded = this.themeOptions.classList.contains('show');
        this.themeOptions.classList.toggle('show');
        this.themeToggle.setAttribute('aria-expanded', !isExpanded);
        
        if (!isExpanded) {
            const activeButton = this.themeOptions.querySelector('.theme-option.active');
            if (activeButton) {
                activeButton.focus();
            }
        }
    }

    closeThemeMenu() {
        this.themeOptions.classList.remove('show');
        this.themeToggle.setAttribute('aria-expanded', false);
    }

    handleClickOutside(event) {
        if (!this.themeToggle.contains(event.target) && !this.themeOptions.contains(event.target)) {
            this.closeThemeMenu();
        }
    }
}

// Initialize theme manager
const themeManager = new ThemeManager(); 