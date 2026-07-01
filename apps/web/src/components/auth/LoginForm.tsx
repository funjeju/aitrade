"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "@/i18n/navigation";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const { configured, user, signInEmail, signUpEmail, signInAnon } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인돼 있으면 대시보드로.
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void run(() =>
      mode === "signIn"
        ? signInEmail(email, password)
        : signUpEmail(email, password),
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <span className={styles.brand}>ATS-OS</span>
        <p className={styles.subtitle}>{t("subtitle")}</p>

        {!configured ? (
          <p className={styles.err}>{t("notConfigured")}</p>
        ) : (
          <>
            <form onSubmit={onSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  {t("email")}
                </label>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  {t("password")}
                </label>
                <input
                  id="password"
                  className={styles.input}
                  type="password"
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button type="submit" className={styles.primary} disabled={busy}>
                {busy
                  ? t("working")
                  : mode === "signIn"
                    ? t("signInBtn")
                    : t("signUpBtn")}
              </button>

              <button
                type="button"
                className={styles.toggle}
                onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
              >
                {mode === "signIn" ? t("toggleToSignUp") : t("toggleToSignIn")}
              </button>
            </form>

            <div className={styles.divider}>{t("or")}</div>

            <button
              type="button"
              className={styles.anon}
              disabled={busy}
              onClick={() => void run(signInAnon)}
            >
              {t("anonBtn")}
            </button>

            {error && <p className={styles.err}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
