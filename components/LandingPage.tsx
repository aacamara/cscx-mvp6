/**
 * LandingPage - Minimalist login page for CSCX.ai
 * Black on white design with red accent
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';

interface LandingPageProps {
  onLogin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const { signInWithGoogle, isLoading } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div className="landing-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .landing-page {
          min-height: 100vh;
          background: #ffffff;
          color: #000000;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .landing-header {
          padding: 2rem 4rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .landing-logo {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .landing-logo .accent {
          color: #e63946;
        }

        .landing-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .landing-content {
          max-width: 580px;
          text-align: center;
        }

        .landing-label {
          font-size: 0.875rem;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #e63946;
          margin-bottom: 1.5rem;
        }

        .landing-title {
          font-size: clamp(2.5rem, 8vw, 4.5rem);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.04em;
          margin-bottom: 1.5rem;
        }

        .landing-title .muted {
          color: #555555;
        }

        .landing-title .accent-dot {
          color: #e63946;
        }

        .landing-subtitle {
          font-size: 1.25rem;
          color: #555555;
          line-height: 1.6;
          margin-bottom: 3rem;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }

        .landing-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .btn-google {
          display: inline-flex;
          align-items: center;
          gap: 0.875rem;
          padding: 1rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          background: #000000;
          color: #ffffff;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-google:hover {
          opacity: 0.85;
          transform: translateY(-2px);
        }

        .btn-google:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-google svg {
          width: 20px;
          height: 20px;
        }

        .landing-note {
          font-size: 0.875rem;
          color: #999999;
        }

        .landing-note a {
          color: #e63946;
          text-decoration: none;
        }

        .landing-note a:hover {
          text-decoration: underline;
        }

        .landing-footer {
          padding: 2rem 4rem;
          border-top: 1px solid #e5e5e5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          color: #999999;
        }

        .landing-footer a {
          color: #555555;
          text-decoration: none;
        }

        .landing-footer a:hover {
          color: #000000;
        }

        .footer-links {
          display: flex;
          gap: 2rem;
        }

        @media (max-width: 768px) {
          .landing-header {
            padding: 1.5rem 1.5rem;
          }

          .landing-subtitle {
            font-size: 1.125rem;
          }

          .landing-footer {
            padding: 1.5rem;
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .footer-links {
            gap: 1.5rem;
          }
        }
      `}</style>

      <header className="landing-header">
        <div className="landing-logo">
          CSCX<span className="accent">.</span>ai
        </div>
      </header>

      <main className="landing-main">
        <div className="landing-content">
          <div className="landing-label">Customer Success Platform</div>

          <h1 className="landing-title">
            The future of<br />
            <span className="muted">Customer Success</span><span className="accent-dot">.</span>
          </h1>

          <p className="landing-subtitle">
            AI-powered workflows that automate onboarding,
            orchestrate agents, and turn your playbooks into
            intelligent systems.
          </p>

          <div className="landing-cta">
            <button
              className="btn-google"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isLoading ? 'Signing in...' : 'Continue with Google'}
            </button>

            <p className="landing-note">
              By signing in, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
            </p>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <div>&copy; 2025 CSCX.ai — CAS Advisory</div>
        <div className="footer-links">
          <a href="#">About</a>
          <a href="#">Contact</a>
          <a href="mailto:info@casadvisory.ca">info@casadvisory.ca</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
