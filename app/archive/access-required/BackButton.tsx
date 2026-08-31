"use client";

export default function BackButton() {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("/");
  };

  return (
    <button type="button" className="archive-access-required-back" onClick={goBack}>
      이전으로 돌아가기
    </button>
  );
}
