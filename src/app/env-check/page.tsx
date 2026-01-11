export default function EnvCheckPage() {
  return (
    <pre style={{ padding: 24 }}>
      {JSON.stringify(
        {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
          NEXT_PUBLIC_SUPABASE_ANON_KEY_PRESENT: Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ),
        },
        null,
        2
      )}
    </pre>
  );
}