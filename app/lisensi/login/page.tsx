import { LoginForm } from "@/components/lisensi/LoginForm";

export default function LisensiLoginPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-lg font-semibold text-ink">Masuk</h1>
      <p className="mt-1 text-sm text-muted">
        Bagian ini hanya untuk penerbit lisensi. Generator setup MikroTik tetap terbuka untuk umum di{" "}
        <span className="font-mono text-xs text-brand">/setup</span>.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
