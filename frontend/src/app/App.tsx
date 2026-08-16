import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { DayOfWeek, Match, Proposal, ProposalStatus, Venue } from "../lib/contracts";

type Tab = "matches" | "proposals" | "schedule" | "profile";
type Schedule = { id: string; day: DayOfWeek; subject: string; start: string; end: string };

const tabs: Array<{ id: Tab; label: string }> = [{ id: "matches", label: "메이트 찾기" }, { id: "proposals", label: "제안 · 약속" }, { id: "schedule", label: "시간표" }, { id: "profile", label: "내 프로필" }];
const dayLabels: Record<DayOfWeek, string> = { MONDAY: "월", TUESDAY: "화", WEDNESDAY: "수", THURSDAY: "목", FRIDAY: "금" };

function ShibaAvatar({ className = "" }: { className?: string }) {
  return <span className={`shiba-avatar ${className}`}><span aria-hidden="true">🐕</span><img src="/shiba-default.png" alt="시바견 프로필" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span>;
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  return isAuthenticated ? <ServiceApp onSignOut={() => setIsAuthenticated(false)} /> : <AuthPage onAuthenticated={() => setIsAuthenticated(true)} />;
}

function ServiceApp({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("matches");
  const [matches, setMatches] = useState<Match[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => void Promise.all([api.getMatches(), api.getProposals({ status: "PENDING,ACCEPTED" })]).then(([matchPage, proposalPage]) => { setMatches(matchPage.data); setProposals(proposalPage.data); setError(null); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "데이터를 불러오지 못했어요."));
  useEffect(load, []);
  const changeStatus = async (id: string, status: ProposalStatus) => { try { await api.changeProposalStatus(id, status); load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "제안 상태를 바꾸지 못했어요."); } };

  const isChatMode = tab === "matches";
  return <><header className="site-header"><button className="brand" onClick={() => setTab("matches")} aria-label="Lunch Mate 홈"><span>LM</span>Lunch Mate</button><nav aria-label="주 메뉴">{tabs.map((item) => <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav><div className="user-menu"><ShibaAvatar className="user-avatar" /><span className="user-name">민지</span><button className="signout" onClick={onSignOut}>로그아웃</button></div></header><main className={isChatMode ? "chat-page" : "app-shell"}>
    {!isChatMode && <header className="hero"><div><p className="eyebrow">LUNCH MATE</p><h1>공강을 같이 보낼<br />친구를 찾아보세요.</h1><p className="subtle">같은 캠퍼스에서 실제로 만날 수 있는 점심 시간을 연결합니다.</p></div><div className="hero-actions"><div className="status-pill"><span>●</span> 매칭 준비 완료</div></div></header>}
    {error && <p className="error" role="alert">{error}</p>}
    {tab === "matches" && <Matches matches={matches} />}
    {tab === "proposals" && <Proposals proposals={proposals} onChange={changeStatus} />}
    {tab === "schedule" && <ScheduleView />}
    {tab === "profile" && <ProfileView />}
  </main></>;
}

function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (!email.includes("@") || password.length < 8) return setError("이메일과 8자 이상의 비밀번호를 확인해 주세요.");
    if (mode === "signup" && (nickname.trim().length < 2 || password !== passwordConfirm)) return setError("닉네임은 2자 이상이며, 비밀번호가 서로 같아야 해요.");
    setError(""); onAuthenticated();
  };
  const switchMode = (next: "login" | "signup") => { setMode(next); setError(""); };
  return <main className="auth-page"><section className="auth-intro"><p className="eyebrow">LUNCH MATE</p><h1>점심 공강,<br /><em>혼자 보내지 마세요.</em></h1><p>같은 캠퍼스에서 공강이 겹치는 친구를 만나 보세요.</p><ul><li>같은 캠퍼스의 메이트 추천</li><li>공통 공강 시간으로 안전한 제안</li><li>시간에 맞는 점심 장소 추천</li></ul></section><section className="auth-card"><div className="auth-brand">LM</div><div className="auth-heading"><p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "START LUNCH MATE"}</p><h2>{mode === "login" ? "다시 만나서 반가워요" : "점심 메이트를 찾아볼까요?"}</h2><p>{mode === "login" ? "로그인하고 오늘의 공강 메이트를 확인하세요." : "가입 후 프로필과 공강 시간을 설정할 수 있어요."}</p></div><div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => switchMode("login")}>로그인</button><button className={mode === "signup" ? "selected" : ""} onClick={() => switchMode("signup")}>회원가입</button></div><form onSubmit={(event) => { event.preventDefault(); submit(); }}><label>이메일<input type="email" autoComplete="email" placeholder="you@university.ac.kr" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{mode === "signup" && <label>닉네임<input placeholder="2~20자" value={nickname} onChange={(event) => setNickname(event.target.value)} required /></label>}<label>비밀번호<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="8자 이상 입력" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{mode === "signup" && <label>비밀번호 확인<input type="password" autoComplete="new-password" placeholder="비밀번호를 다시 입력" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required /></label>}{mode === "login" && <label className="remember"><input type="checkbox" /> 로그인 상태 유지</label>}{error && <p className="error">{error}</p>}<button className="primary full-width auth-submit" type="submit">{mode === "login" ? "로그인" : "회원가입하고 시작하기"}</button></form><p className="auth-notice">현재는 화면 목업입니다. 인증 서버 연동 시 이 폼이 실제 로그인으로 연결됩니다.</p></section></main>;
}

function Matches({ matches }: { matches: Match[] }) {
  const [text, setText] = useState(""); const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: "assistant" | "user"; text: string }>>([{ id: "welcome", role: "assistant", text: "안녕하세요! 🤖 언제, 얼마나 오래 점심을 먹고 싶은지 편하게 말해 주세요. 공강이 맞는 메이트를 찾아드릴게요." }]);
  const [match, setMatch] = useState<Match | null>(null); const [venues, setVenues] = useState<Venue[]>([]); const [venueIndex, setVenueIndex] = useState(0); const [modal, setModal] = useState<"match" | "venues" | "sent" | null>(null);
  const send = async (content = text) => { const prompt = content.trim(); if (!prompt || isSending) return; setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: prompt }]); setText(""); setIsSending(true); try { const response = await api.sendMatchChat(prompt); const found = response.data.matches[0] ?? matches[0] ?? null; setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: response.data.assistantMessage }]); if (found) { setMatch(found); setModal("match"); } } catch (cause) { setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: cause instanceof Error ? cause.message : "잠시 문제가 생겼어요. 다시 요청해 주세요." }]); } finally { setIsSending(false); } };
  const acceptMatch = async () => { if (!match) return; const slot = match.commonSlots[0]; const query = new URLSearchParams({ campusId: match.campus.id, date: slot.nextDate ?? "2026-08-20", startTime: slot.startTime, endTime: slot.endTime, activity: "LUNCH" }); const response = await api.getVenueRecommendations(query); setVenues(response.data); setVenueIndex(0); setModal("venues"); };
  const sendProposal = async () => { if (!match || !venues[venueIndex]) return; const slot = match.commonSlots[0]; await api.createProposal({ receiverId: match.userId, date: slot.nextDate ?? "2026-08-20", startTime: slot.startTime, endTime: slot.endTime, activity: "LUNCH", venue: { type: "RECOMMENDED", venueId: venues[venueIndex].id }, message: null }); setModal("sent"); setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: `${venues[venueIndex].name}에서 만나는 점심 제안을 보냈어요! 🍽️` }]); };
  return <section className="chat-fullscreen"><div className="chat-card"><header className="chat-heading"><ShibaAvatar className="assistant-avatar" /><div><p className="eyebrow">LUNCH MATE AI</p><h2>점심 약속을 말로 잡아보세요</h2><span>공강을 확인해 딱 맞는 메이트를 찾아드려요.</span></div></header><div className="chat-log" aria-live="polite">{messages.map((message) => <article className={`chat-message ${message.role}`} key={message.id}>{message.role === "assistant" && <ShibaAvatar className="message-avatar" />}<p>{message.text}</p></article>)}{isSending && <article className="chat-message assistant"><ShibaAvatar className="message-avatar" /><p className="typing">추천을 찾고 있어요…</p></article>}</div><div className="quick-prompts">{["월요일 12시에 한 시간 점심 먹을 친구 찾아줘", "이번 주 공강에 가까운 곳에서 점심 먹고 싶어", "90분 동안 대화하며 점심 먹을 메이트 찾아줘"].map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea aria-label="AI에게 보낼 메시지" placeholder="예: 목요일 12시쯤, 조용한 곳에서 점심 먹고 싶어" value={text} onChange={(event) => setText(event.target.value)} rows={2} /><button className="primary" type="submit" disabled={!text.trim() || isSending}>보내기 ↑</button></form></div>{modal && match && <div className="dialog-backdrop"><section className="match-modal" role="dialog" aria-modal="true"><button className="close" onClick={() => setModal(null)} aria-label="닫기">×</button>{modal === "match" && <><ShibaAvatar className="match-profile" /><p className="eyebrow">AI MATCH FOUND</p><h2>{match.nickname}님을 찾았어요!</h2><p>{match.summary}</p><div className="chips">{match.commonSlots.map((slot) => <span key={slot.startTime}>{dayLabels[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}</span>)}</div><div className="actions"><button className="secondary" onClick={() => setModal(null)}>다시 찾아보기</button><button className="primary" onClick={() => void acceptMatch()}>이 메이트와 점심 잡기</button></div></>}{modal === "venues" && <><ShibaAvatar className="match-profile" /><p className="eyebrow">PERSONALIZED PLACES</p><h2>어디서 만날까요?</h2><p>{match.nickname}님과의 공강 시간에 맞춰 골랐어요.</p>{venues.length > 0 && <div className="venue-carousel"><button aria-label="이전 장소" onClick={() => setVenueIndex((index) => (index + venues.length - 1) % venues.length)}>←</button><article><span>{venueIndex + 1} / {venues.length}</span><h3>{venues[venueIndex].name}</h3><p>🚶 도보 {venues[venueIndex].walkMinutes}분 · {venues[venueIndex].description}</p><small>{venues[venueIndex].recommendationReason}</small></article><button aria-label="다음 장소" onClick={() => setVenueIndex((index) => (index + 1) % venues.length)}>→</button></div>}<button className="primary full-width" disabled={!venues.length} onClick={() => void sendProposal()}>이 장소로 제안 보내기</button></>}{modal === "sent" && <><ShibaAvatar className="match-profile" /><p className="eyebrow">PROPOSAL SENT</p><h2>점심 제안을 보냈어요</h2><p>{match.nickname}님의 응답을 기다리는 동안 다른 공강도 확인해 보세요.</p><button className="primary full-width" onClick={() => setModal(null)}>채팅으로 돌아가기</button></>}</section></div>}</section>;
}

function Proposals({ proposals, onChange }: { proposals: Proposal[]; onChange: (id: string, status: ProposalStatus) => void }) {
  const [filter, setFilter] = useState<"all" | "received" | "sent" | "appointments">("all");
  const visible = proposals.filter((item) => filter === "all" || filter === "appointments" && item.status === "ACCEPTED" || filter === "received" && item.role === "RECEIVED" || filter === "sent" && item.role === "SENT");
  return <section><div className="section-heading"><div><p className="eyebrow">내 점심 약속</p><h2>📬 제안 · 약속</h2></div><div className="filter-group">{(["all", "received", "sent", "appointments"] as const).map((item) => <button className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{({ all: "전체", received: "받은 제안", sent: "보낸 제안", appointments: "확정" })[item]}</button>)}</div></div>{!visible.length ? <Empty title="표시할 제안이 없어요" text="추천 메이트에게 먼저 점심을 제안해 보세요." /> : <div className="card-list">{visible.map((item) => <article className="card proposal-card" key={item.id}><div className="card-heading"><div><h2>{item.counterpart.nickname}님과의 점심</h2><p>{item.date} · {item.startTime}–{item.endTime}</p></div><Status status={item.status} /></div><p className="venue">⌖ {item.venue.name}{item.venue.walkMinutes ? ` · 도보 ${item.venue.walkMinutes}분` : ""}</p><Actions proposal={item} onChange={onChange} /></article>)}</div>}</section>;
}

function Actions({ proposal, onChange }: { proposal: Proposal; onChange: (id: string, status: ProposalStatus) => void }) {
  if (proposal.status === "PENDING" && proposal.role === "RECEIVED") return <div className="actions"><button className="secondary" onClick={() => onChange(proposal.id, "REJECTED")}>거절</button><button className="primary" onClick={() => onChange(proposal.id, "ACCEPTED")}>수락</button></div>;
  if (proposal.status === "PENDING") return <div className="actions"><button className="secondary" onClick={() => onChange(proposal.id, "CANCELED")}>제안 취소</button></div>;
  if (proposal.status === "ACCEPTED") return <div className="actions"><button className="secondary" onClick={() => onChange(proposal.id, "CANCELED")}>약속 취소</button></div>;
  return null;
}

function Status({ status }: { status: ProposalStatus }) { return <span className={`status ${status.toLowerCase()}`}>{({ PENDING: "응답 대기", ACCEPTED: "약속 확정", REJECTED: "거절됨", CANCELED: "취소됨" })[status]}</span>; }

function ScheduleView() {
  const [schedules, setSchedules] = useState<Schedule[]>([{ id: "1", day: "MONDAY", subject: "통계학", start: "11:00", end: "12:00" }, { id: "2", day: "WEDNESDAY", subject: "웹프로그래밍", start: "13:00", end: "14:30" }]);
  const [form, setForm] = useState<Omit<Schedule, "id">>({ day: "TUESDAY", subject: "", start: "12:00", end: "13:00" });
  const [message, setMessage] = useState("");
  const timeSlots = Array.from({ length: 8 }, (_, index) => `${String(11 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
  const minutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
  const position = (time: string) => (minutes(time) - 11 * 60) / 30 * 48;
  const add = () => { if (!form.subject.trim() || form.start >= form.end) return setMessage("과목명과 올바른 시간을 입력해 주세요."); if (schedules.some((item) => item.day === form.day && form.start < item.end && item.start < form.end)) return setMessage("같은 요일의 수업 시간은 겹칠 수 없어요."); setSchedules((items) => [...items, { ...form, id: crypto.randomUUID() }]); setForm((current) => ({ ...current, subject: "" })); setMessage("수업을 추가했어요. API 연결 시 서버에 저장됩니다."); };
  return <section><div className="section-heading"><div><p className="eyebrow">온보딩 2/3</p><h2>🗓️ 시간표와 공강</h2></div><span className="service-window">🍽️ 점심 서비스 11:00–15:00</span></div><div className="timetable" aria-label="월요일부터 금요일까지의 점심 시간표"><div className="timetable-top"><span /><div>{(Object.keys(dayLabels) as DayOfWeek[]).map((day) => <strong key={day}>{dayLabels[day]}</strong>)}</div></div><div className="timetable-body"><div className="time-axis">{timeSlots.map((time) => <span key={time}>{time}</span>)}</div><div className="timetable-days">{(Object.keys(dayLabels) as DayOfWeek[]).map((day) => <div className="timetable-day" key={day}>{schedules.filter((item) => item.day === day).map((item) => <div className="class-block" key={item.id} style={{ top: position(item.start), height: position(item.end) - position(item.start) }}><strong>{item.subject}</strong><span>{item.start}–{item.end}</span></div>)}</div>)}</div></div></div><p className="timetable-caption">☀️ 빈 칸은 점심 메이트를 만날 수 있는 공강이에요.</p><div className="add-form"><h3>수업 추가</h3><input placeholder="과목명" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /><select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value as DayOfWeek })}>{(Object.keys(dayLabels) as DayOfWeek[]).map((day) => <option key={day} value={day}>{dayLabels[day]}요일</option>)}</select><Time value={form.start} onChange={(start) => setForm({ ...form, start })} /><Time value={form.end} onChange={(end) => setForm({ ...form, end })} /><button className="primary" onClick={add}>추가</button></div>{message && <p className="form-message">{message}</p>}</section>;
}

function ProfileView() {
  const interests = ["음악", "여행", "영화", "맛집", "게임", "운동", "책", "테크"];
  const [selected, setSelected] = useState(["음악", "여행"]); const [discoverable, setDiscoverable] = useState(true); const [minimum, setMinimum] = useState(60);
  const toggle = (interest: string) => setSelected((items) => items.includes(interest) ? items.filter((item) => item !== interest) : items.length < 10 ? [...items, interest] : items);
  return <section className="profile-layout"><div><p className="eyebrow">온보딩 1/3</p><h2>나를 소개해 주세요</h2><p className="subtle">관심사가 비슷하고 공강이 겹치는 메이트를 추천해 드려요.</p><label className="field-label">관심사 <span>{selected.length}/10</span></label><div className="interest-grid">{interests.map((interest) => <button className={selected.includes(interest) ? "selected" : ""} key={interest} onClick={() => toggle(interest)}>{interest}</button>)}</div></div><aside className="settings-card"><h3>매칭 설정</h3><label className="switch-row"><span><strong>다른 학생에게 보이기</strong><small>해제해도 내 추천은 볼 수 있어요.</small></span><input type="checkbox" checked={discoverable} onChange={(event) => setDiscoverable(event.target.checked)} /></label><label className="field-label">최소 만남 시간</label><div className="duration-row">{[30, 60, 90, 120].map((minutes) => <button className={minimum === minutes ? "selected" : ""} key={minutes} onClick={() => setMinimum(minutes)}>{minutes}분</button>)}</div><button className="primary full-width">변경사항 저장</button></aside></section>;
}

function ProposalDialog({ match, onClose, onComplete }: { match: Match; onClose: () => void; onComplete: () => void }) {
  const [venues, setVenues] = useState<Venue[]>([]); const [venueId, setVenueId] = useState(""); const [custom, setCustom] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [sending, setSending] = useState(false); const slot = match.commonSlots[0];
  useEffect(() => { const query = new URLSearchParams({ campusId: match.campus.id, date: slot.nextDate ?? "2026-08-20", startTime: slot.startTime, endTime: slot.endTime, activity: "LUNCH" }); void api.getVenueRecommendations(query).then((response) => { setVenues(response.data); setVenueId(response.data[0]?.id ?? ""); }).catch(() => setError("장소 추천을 불러오지 못했어요.")); }, [match, slot]);
  const submit = async () => { if (!venueId && custom.trim().length < 2) return setError("추천 장소를 고르거나 2자 이상 장소를 입력해 주세요."); try { setSending(true); await api.createProposal({ receiverId: match.userId, date: slot.nextDate ?? "2026-08-20", startTime: slot.startTime, endTime: slot.endTime, activity: "LUNCH", venue: custom.trim() ? { type: "CUSTOM", name: custom.trim() } : { type: "RECOMMENDED", venueId }, message: message.trim() || null }); onComplete(); } catch (cause) { setError(cause instanceof Error ? cause.message : "제안을 보내지 못했어요."); } finally { setSending(false); } };
  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="proposal-title"><button className="close" onClick={onClose} aria-label="닫기">×</button><p className="eyebrow">점심 제안</p><h2 id="proposal-title">{match.nickname}님에게 제안하기</h2><div className="proposal-time"><strong>{dayLabels[slot.dayOfWeek]}요일 {slot.startTime}–{slot.endTime}</strong><span>{slot.durationMinutes}분 동안 만날 수 있어요.</span></div><h3>추천 장소</h3><div className="venue-list">{venues.map((venue) => <label className={venueId === venue.id && !custom ? "venue selected" : "venue"} key={venue.id}><input type="radio" checked={venueId === venue.id && !custom} onChange={() => { setVenueId(venue.id); setCustom(""); }} /><span><strong>{venue.name}</strong><small>도보 {venue.walkMinutes}분 · {venue.recommendationReason}</small></span></label>)}</div><input className="custom-venue" placeholder="또는 직접 장소 입력 (2~50자)" value={custom} onChange={(event) => setCustom(event.target.value)} /><textarea placeholder="메시지 (선택, 최대 200자)" maxLength={200} value={message} onChange={(event) => setMessage(event.target.value)} />{error && <p className="error">{error}</p>}<button className="primary full-width" disabled={sending} onClick={submit}>{sending ? "보내는 중…" : "점심 제안 보내기"}</button></section></div>;
}

function Time({ value, onChange }: { value: string; onChange: (value: string) => void }) { const times = Array.from({ length: 9 }, (_, index) => `${String(11 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`); return <select value={value} onChange={(event) => onChange(event.target.value)}>{times.map((time) => <option key={time}>{time}</option>)}</select>; }
function Empty({ title, text }: { title: string; text: string }) { return <section className="empty"><h2>{title}</h2><p>{text}</p></section>; }
