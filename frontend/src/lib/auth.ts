import { setAccessToken } from "./api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  session?: { access_token?: string; refresh_token?: string } | null;
  user?: { id: string; email?: string | null } | null;
  msg?: string;
  message?: string;
  error_description?: string;
};

type StoredSession = { accessToken: string; refreshToken: string };
type StoredSessionEntry = { session: StoredSession; isPersistent: boolean };

const AUTH_SESSION_KEY = "campusmate.auth.session";

function configured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

async function request(path: string, body: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase 인증 설정이 없습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해 주세요.");
  const response = await fetch(`${supabaseUrl}${path}`, {
    method: "POST",
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as SupabaseAuthResponse;
  if (!response.ok) throw new Error(payload.error_description ?? payload.message ?? payload.msg ?? "인증 요청에 실패했어요.");
  return payload;
}

function sessionFromPayload(payload: SupabaseAuthResponse): StoredSession | null {
  const accessToken = payload.access_token ?? payload.session?.access_token;
  const refreshToken = payload.refresh_token ?? payload.session?.refresh_token;
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

function storeSession(payload: SupabaseAuthResponse, isPersistent: boolean) {
  const session = sessionFromPayload(payload);
  if (!session) return false;
  clearStoredSession();
  const storage = isPersistent ? localStorage : sessionStorage;
  storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  setAccessToken(session.accessToken);
  return true;
}

function readStoredSession(): StoredSessionEntry | null {
  for (const [storage, isPersistent] of [[localStorage, true], [sessionStorage, false]] as const) {
    try {
      const value = storage.getItem(AUTH_SESSION_KEY);
      if (!value) continue;
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== "object") continue;
      const session = parsed as Partial<StoredSession>;
      if (typeof session.accessToken === "string" && typeof session.refreshToken === "string") return { session: { accessToken: session.accessToken, refreshToken: session.refreshToken }, isPersistent };
    } catch {
      storage.removeItem(AUTH_SESSION_KEY);
    }
  }
  return null;
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export async function restoreAuthSession() {
  const stored = readStoredSession();
  if (!stored) {
    setAccessToken(null);
    return false;
  }
  try {
    const payload = await request("/auth/v1/token?grant_type=refresh_token", { refresh_token: stored.session.refreshToken });
    if (!storeSession(payload, stored.isPersistent)) throw new Error("세션 갱신 토큰을 받지 못했어요.");
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

export function clearAuthSession() {
  clearStoredSession();
  setAccessToken(null);
}

export async function signInWithEmail(email: string, password: string, isPersistent = false) {
  const payload = await request("/auth/v1/token?grant_type=password", { email, password });
  if (!storeSession(payload, isPersistent)) throw new Error("로그인 토큰을 받지 못했어요.");
}

export async function signUpWithEmail(email: string, password: string, nickname: string, isPersistent = false) {
  const payload = await request("/auth/v1/signup", { email, password, data: { nickname } });
  if (!storeSession(payload, isPersistent)) throw new Error("가입 확인 메일을 보냈어요. 이메일 인증 후 로그인해 주세요.");
}

export function hasSupabaseAuthConfig() {
  return configured();
}
