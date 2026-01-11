export default function VersionPage() {
  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Deployed Version</h1>
      <p style={{ marginTop: 12 }}>
        <strong>VERCEL_GIT_COMMIT_SHA:</strong>{" "}
        {process.env.VERCEL_GIT_COMMIT_SHA ?? "(not set)"}
      </p>
      <p style={{ marginTop: 8 }}>
        <strong>VERCEL_GIT_COMMIT_MESSAGE:</strong>{" "}
        {process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "(not set)"}
      </p>
      <p style={{ marginTop: 8 }}>
        <strong>VERCEL_GIT_REPO_SLUG:</strong>{" "}
        {process.env.VERCEL_GIT_REPO_SLUG ?? "(not set)"}
      </p>
      <p style={{ marginTop: 8 }}>
        <strong>VERCEL_ENV:</strong> {process.env.VERCEL_ENV ?? "(not set)"}
      </p>
    </main>
  );
}
