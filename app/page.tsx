import Link from "next/link";

export default function Home() {
  return (
    <div>
      <section className="hero">
        <h1>Is your match actually real?</h1>
        <p>
          Scammers now use AI faces that don&apos;t reverse-search and photos that were never
          taken. GILLTY gives real people a tamper-proof way to prove their photos were captured
          live — and lets you check a match before you fall for a ghost.
        </p>
      </section>

      <div className="choices">
        <div className="card">
          <h3>Verify me</h3>
          <p>Capture your photo live. We seal it on Solana so it can&apos;t be faked or swapped.</p>
          <div style={{ marginTop: 16 }}>
            <Link href="/capture" className="btn">
              Capture &amp; seal
            </Link>
          </div>
        </div>

        <div className="card">
          <h3>Check a match</h3>
          <p>Drop in a photo from a profile. We&apos;ll tell you if it has a live-capture seal.</p>
          <div style={{ marginTop: 16 }}>
            <Link href="/verify" className="btn secondary">
              Run a check
            </Link>
          </div>
        </div>
      </div>

      <p className="hint">
        GILLTY proves a photo was captured live by a specific device and hasn&apos;t been altered —
        it does not judge whether someone is honest about anything else. Your image never leaves
        your device; only a mathematical fingerprint is registered.
      </p>
    </div>
  );
}
