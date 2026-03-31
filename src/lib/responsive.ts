// Responsive utilities for mobile-first design

// Breakpoints matching Tailwind defaults
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

// Touch target sizes (WCAG 2.5.5 - minimum 44x44px)
export const touchTarget = {
  small: 40,    // Minimum for icons
  medium: 44,   // Standard button size
  large: 48,    // Preferred for primary actions
}

// Mobile-optimized styles
export const mobileStyles = {
  button: {
    minHeight: 44,
    minWidth: 44,
    padding: '12px 16px',
    fontSize: 16, // Prevents iOS zoom on focus
  },
  input: {
    minHeight: 44,
    padding: '12px 14px',
    fontSize: 16, // Prevents iOS zoom on focus
  },
  touchable: {
    minHeight: 44,
    minWidth: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

// Responsive container styles
export const containerStyles = {
  mobile: {
    padding: '12px',
    gap: '12px',
  },
  tablet: {
    padding: '16px',
    gap: '16px',
  },
  desktop: {
    padding: '24px',
    gap: '24px',
  },
}

// Responsive grid columns
export const gridCols = {
  mobile: 1,
  tablet: 2,
  desktop: 4,
}

// Table responsive styles
export const tableStyles = {
  mobile: {
    // Stack cells vertically
    td: {
      display: 'block',
      textAlign: 'right',
      paddingLeft: '50%',
      position: 'relative',
    },
    th: {
      display: 'none',
    },
    tr: {
      display: 'block',
      marginBottom: '1rem',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '12px',
    },
  },
  desktop: {
    // Standard table layout
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      padding: '12px 16px',
      textAlign: 'left',
      borderBottom: '1px solid var(--border)',
    },
    td: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
    },
  },
}

// Modal responsive styles
export const modalStyles = {
  mobile: {
    position: 'fixed',
    inset: 0,
    background: 'var(--surface)',
    borderRadius: 0,
    padding: '16px',
    overflow: 'auto',
  },
  desktop: {
    position: 'relative',
    background: 'var(--surface)',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
}

// Safe area insets for notched phones
export const safeArea = {
  top: 'env(safe-area-inset-top)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
  right: 'env(safe-area-inset-right)',
}

// Mobile bottom navigation styles
export const bottomNavStyles = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-around',
    padding: `8px ${safeArea.left} calc(8px + ${safeArea.bottom}) ${safeArea.right}`,
    zIndex: 100,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: '8px',
    minHeight: 44,
    minWidth: 60,
    textDecoration: 'none',
    transition: 'all 0.15s',
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: 500,
  },
}

// Responsive spacing scale
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
}

// Mobile-friendly card styles
export const cardStyles = {
  default: {
    background: 'var(--surface)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid var(--border)',
  },
  compact: {
    background: 'var(--surface)',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid var(--border)',
  },
}

// Swipe action thresholds
export const swipeThreshold = {
  horizontal: 50,  // Minimum distance for swipe
  vertical: 30,    // Minimum distance for vertical swipe
  velocity: 0.5,   // Minimum velocity for quick swipe
}

// Mobile keyboard types
export const inputModes = {
  text: 'text',
  numeric: 'numeric',
  decimal: 'decimal',
  email: 'email',
  tel: 'tel',
  url: 'url',
  search: 'search',
}
