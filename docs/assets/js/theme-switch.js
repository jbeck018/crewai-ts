// Theme switching functionality with memory optimization
document.addEventListener('DOMContentLoaded', function() {
  // Memory-efficient approach using constants and minimal DOM operations
  const THEME_STORAGE_KEY = 'crewai-ts-theme-preference';
  const DARK_MODE_CLASS = 'custom-dark-mode';
  const LIGHT_MODE = 'light';
  const DARK_MODE = 'dark';

  // Initialize theme from user preference (stored in localStorage)
  function initializeTheme() {
    // Memory-efficient storage - use localStorage to avoid unnecessary calculations on each page load
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (storedTheme === DARK_MODE || (!storedTheme && prefersDarkScheme.matches)) {
      enableDarkMode();
    } else {
      enableLightMode();
    }
    
    // Create and insert theme toggle once per page
    createThemeToggle();
  }

  // Enable dark mode with performance optimization
  function enableDarkMode() {
    // Performance optimization: modify classList instead of setting style properties
    document.body.classList.add(DARK_MODE_CLASS);
    localStorage.setItem(THEME_STORAGE_KEY, DARK_MODE);
    updateToggleButton(true);
  }

  // Enable light mode with performance optimization
  function enableLightMode() {
    document.body.classList.remove(DARK_MODE_CLASS);
    localStorage.setItem(THEME_STORAGE_KEY, LIGHT_MODE);
    updateToggleButton(false);
  }

  // Toggle theme with optimized event handling
  function toggleTheme() {
    // Check current state just once - more efficient than multiple DOM operations
    const isDarkMode = document.body.classList.contains(DARK_MODE_CLASS);
    if (isDarkMode) {
      enableLightMode();
    } else {
      enableDarkMode();
    }
  }

  // Create theme toggle button with memory-efficient DOM operations
  function createThemeToggle() {
    // Minimize DOM operations for performance
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'theme-toggle-container';
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'theme-toggle-button';
    toggleButton.setAttribute('aria-label', 'Toggle theme');
    toggleButton.setAttribute('title', 'Toggle light/dark theme');
    
    // Set initial button state
    const isDarkMode = document.body.classList.contains(DARK_MODE_CLASS);
    updateButtonContent(toggleButton, isDarkMode);
    
    // Memory-efficient event listener (single listener vs multiple)
    toggleButton.addEventListener('click', toggleTheme);
    
    toggleContainer.appendChild(toggleButton);
    
    // Find insertion point - just once for efficiency
    const header = document.querySelector('.site-header') || document.querySelector('header');
    if (header) {
      header.appendChild(toggleContainer);
    }
  }

  // Update button content with minimal DOM operations
  function updateButtonContent(button, isDarkMode) {
    if (!button) return;
    
    // Use efficient string template for button content
    button.innerHTML = isDarkMode ?
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>Light Mode' :
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>Dark Mode';
  }

  // Update existing toggle button with minimal DOM operations
  function updateToggleButton(isDarkMode) {
    const toggleButton = document.querySelector('.theme-toggle-button');
    if (toggleButton) {
      updateButtonContent(toggleButton, isDarkMode);
    }
  }

  // Media query change handler with debounce for performance
  let debounceTimer;
  const handleMediaChange = function(mediaQuery) {
    // Debounce for better performance - avoids rapid changes
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (mediaQuery.matches) {
        enableDarkMode();
      } else {
        enableLightMode();
      }
    }, 200);
  };

  // Watch for system theme changes if no user preference
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Use the proper event based on browser support for better compatibility
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else if (mediaQuery.addListener) {
    mediaQuery.addListener(handleMediaChange);
  }

  // Initialize theme immediately
  initializeTheme();
});
