import { Link } from 'react-router-dom';
export function Mark(){return <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m4 5 12 23L28 5M10 5l6 12 6-12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
export function Brand(){return <Link className="brand" to="/" aria-label="Vigil home"><Mark/><span>vigil<span className="brand-period">.</span></span></Link>}
