"use client";

import { useState } from "react";

type ImportedCounts = {
  members: number;
  businesses: number;
  businessApplications: number;
};

export default function MigrationImport() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState<ImportedCounts | null>(null);

  async function importData() {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setComplete(null);
    try {
      const payload = JSON.parse(await file.text());
      const response = await fetch("/api/admin/migration-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        imported?: ImportedCounts;
      };
      if (!response.ok || !result.imported) throw new Error(result.error || "가져오기에 실패했습니다.");
      setComplete(result.imported);
      setMessage("이전이 완료됐습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "파일을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "80px auto", padding: "0 24px" }}>
      <p style={{ color: "#8a7b68", fontWeight: 700 }}>ADMIN · DATA MIGRATION</p>
      <h1>기존 운영 데이터 가져오기</h1>
      <p>기존 사이트에서 내려받은 JSON 파일을 선택하면 회원과 성도사업장 데이터를 안전하게 가져옵니다.</p>
      <section style={{ marginTop: 32, padding: 28, border: "1px solid #ddd5ca", borderRadius: 16 }}>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy || Boolean(complete)}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={importData}
          disabled={!file || busy || Boolean(complete)}
          style={{ display: "block", marginTop: 20, padding: "12px 20px", cursor: "pointer" }}
        >
          {busy ? "가져오는 중…" : "데이터 가져오기"}
        </button>
        {message && <p style={{ marginTop: 20, fontWeight: 700 }}>{message}</p>}
        {complete && (
          <ul>
            <li>회원 {complete.members}명</li>
            <li>성도사업장 {complete.businesses}곳</li>
            <li>사업장 신청 {complete.businessApplications}건</li>
          </ul>
        )}
      </section>
      <p style={{ marginTop: 24 }}><a href="/admin">관리자 화면으로 돌아가기</a></p>
    </main>
  );
}
