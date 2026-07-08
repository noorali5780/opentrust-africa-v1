import Link from "next/link";

type VerifyPageProps = {
  params: Promise<{ token: string }>;
};

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { token } = await params;

  return (
    <main className="main">
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <div>
              <h1>Certificate Verification</h1>
              <p>OpenTrust Africa verify-only token</p>
            </div>
          </div>
        </div>
        <div className="panel-body">
          <div className="token-box">{token}</div>
          <div className="button-row" style={{ marginTop: 16 }}>
            <Link className="primary-button" href={`/verifier?token=${encodeURIComponent(token)}`}>
              Open verifier
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
