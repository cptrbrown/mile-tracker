"use client";

import { supabase } from "@/lib/supabaseClient";

export default function TestPage() {
  const test = async () => {
    const { data, error } = await supabase.auth.getSession();
    console.log({ data, error });
    alert("Check the console — Supabase is connected!");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Supabase Test</h1>
      <button onClick={test}>Test Supabase Connection</button>
    </div>
  );
}