/**
 * Shared "Powered by Orbitex" Footer
 *
 * Single component replacing hardcoded footers across all public pages.
 * Used on: /bill, /book, /card, /catalog, /review
 */

import './powered-by-footer.css';

export default function PoweredByFooter() {
  return (
    <div className="powered-footer">
      <p className="powered-footer-text">
        Powered by{' '}
        <a
          href="https://orbitex-orbitex.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="powered-footer-link"
        >
          Orbitex
        </a>
      </p>
    </div>
  );
}
