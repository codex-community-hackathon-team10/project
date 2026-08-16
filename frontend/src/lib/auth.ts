import { setAccessToken } from "./api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

type SupabaseAuthResponse = {
  access_token?: string;
  session?: { access_token?: string } | null;
  user?: { id: string; email?: string | null } | null;
  msg?: string;
  message?: string;
  error_description?: string;
};

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

function storeSession(payload: SupabaseAuthResponse) {
  const token = payload.access_token ?? payload.session?.access_token;
  if (!token) return false;
  setAccessToken(token);
  return true;
}

export async function signInWithEmail(email: string, password: string) {
  const payload = await request("/auth/v1/token?grant_type=password", { email, password });
  if (!storeSession(payload)) throw new Error("로그인 토큰을 받지 못했어요.");
}

export async function signUpWithEmail(email: string, password: string, nickname: string) {
  const payload = await request("/auth/v1/signup", { email, password, data: { nickname } });
  if (!storeSession(payload)) throw new Error("가입 확인 메일을 보냈어요. 이메일 인증 후 로그인해 주세요.");
}

export function hasSupabaseAuthConfig() {
  return configured();
}
