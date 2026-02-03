# PRD: Minimalist Landing Page

## Overview
Create a minimalist landing page for CSCX.ai that serves as the entry point for users to authenticate via Google OAuth. The design follows the established black on white aesthetic with #e63946 red accent.

## Design System
- **Background**: #ffffff (white)
- **Text**: #000000 (black)
- **Accent**: #e63946 (red)
- **Muted text**: #555555
- **Font**: Inter (weights: 400, 500, 600, 700, 800)
- **Style**: Minimalist, clean, professional

## User Stories

### US-001: Landing Page Component Structure
**As a** visitor
**I want** to see a clean landing page when not authenticated
**So that** I can understand what CSCX.ai is and sign in

**Acceptance Criteria:**
- Create components/LandingPage.tsx component
- Component receives onLogin callback prop
- Uses useAuth hook from AuthContext for signInWithGoogle
- Page has three sections: header, main content, footer
- Build succeeds with no new TypeScript errors

### US-002: Header with Logo
**As a** visitor
**I want** to see the CSCX.ai branding in the header
**So that** I know what product I'm using

**Acceptance Criteria:**
- Header displays "CSCX.ai" logo text
- Logo uses font-weight 800, letter-spacing -0.03em
- The period after CSCX uses the accent color #e63946
- Header has proper padding (2rem 4rem desktop, 1.5rem mobile)
- Responsive design works on mobile (max-width: 768px)

### US-003: Hero Content Section
**As a** visitor
**I want** to see compelling hero content
**So that** I understand the value proposition

**Acceptance Criteria:**
- Display label "Customer Success Platform" in uppercase with accent color
- Main title: "The future of" on first line, "Customer Success." on second line
- "Customer Success" portion uses muted color #555555
- Period at end uses accent color #e63946
- Subtitle text describes AI-powered workflows for onboarding and agents
- Title uses clamp(2.5rem, 8vw, 4.5rem) for responsive sizing
- Content is centered with max-width 580px

### US-004: Google Sign-In Button
**As a** visitor
**I want** to sign in with Google
**So that** I can access the CSCX.ai platform

**Acceptance Criteria:**
- Button displays Google logo (multicolor SVG) and "Continue with Google" text
- Button calls signInWithGoogle() from useAuth hook on click
- Button shows "Signing in..." when isLoading is true
- Button is disabled during loading state
- Button style: black background, white text, hover opacity 0.85
- Button has hover transform translateY(-2px) for subtle lift effect
- Below button: "By signing in, you agree to our Terms and Privacy Policy"
- Terms and Privacy links use accent color

### US-005: Footer Section
**As a** visitor
**I want** to see footer information
**So that** I can contact or learn more about the company

**Acceptance Criteria:**
- Footer displays "© 2025 CSCX.ai — CAS Advisory"
- Footer links: About, Contact, info@casadvisory.ca (mailto link)
- Footer has top border 1px solid #e5e5e5
- Links use #555555 color, hover to #000000
- Responsive: stacks vertically on mobile with centered text

### US-006: App.tsx Integration
**As a** developer
**I want** the landing page to show when not authenticated
**So that** users see login before accessing the dashboard

**Acceptance Criteria:**
- Import LandingPage component in App.tsx
- If user is not authenticated (no session), render LandingPage instead of main app
- Pass appropriate onLogin callback to LandingPage
- After successful login, user sees the main dashboard
- No flash of dashboard content before redirect to landing page

## Technical Notes
- Use inline styles via `<style>` tag within the component (matching existing patterns)
- Import Inter font from Google Fonts
- Use CSS custom properties where appropriate
- Ensure all responsive breakpoints are handled
- Component should be self-contained with no external CSS dependencies

## Reference
- Design inspiration from /Users/azizcamara/cas-v3-backup-20251230-003046
- Existing AuthContext provides signInWithGoogle and isLoading
- LandingPage.tsx already exists as a starting point - review and enhance as needed
