// 기존 주간 루틴과 수량별 자동 생성, 저장 데이터 검증을 담당한다.
export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export const KINDS = { shoot: '촬영', edit: '편집', up: '콘텐츠 업로드', gbup: '공구 업로드', gb: '공구 준비·대응', plan: '기획' };
export const LIMIT = { content: [0, 5], gb: [0, 3], plan: [0, 3] };
export const ORIGINAL = [
  ['월',13,15,'shoot','콘텐츠 1 촬영'],['월',21,25,'edit','콘텐츠 1 편집'],
  ['화',9,9.5,'up','콘텐츠 1 업로드'],['화',10,12,'shoot','콘텐츠 2 촬영'],['화',13,15,'gb','공구 예고 피드 제작'],['화',21,24,'edit','콘텐츠 2 편집'],
  ['수',9,9.5,'gbup','공구 예고 피드'],['수',13,14,'gb','오픈 피드 준비'],['수',19,19.5,'up','콘텐츠 2 업로드'],
  ['목',9.5,10,'gbup','공구 오픈 피드'],['목',10,12,'gb','공구 오픈 대응'],['목',13,14,'gb','공구 정리'],['목',14,15,'plan','콘텐츠 3 기획'],
  ['금',9.5,11.5,'shoot','신제품 예고 촬영'],['금',13,14,'shoot','콘텐츠 3 촬영'],['금',14,15,'edit','콘텐츠 3 편집'],['금',19,19.5,'up','콘텐츠 3 업로드'],
  ['토',21,23,'edit','신제품 예고 편집']
].map(([day, from, to, kind, name]) => ({ day, from, to, kind, name }));

export function build(set) {
  const events = [];
  const free = (d, a, b) => events.every(e => e.day !== DAYS[d] || e.to <= a || e.from >= b);
  const place = (d, slots, kind, name) => {
    for (const [from, to] of slots) if (free(d, from, to)) {
      events.push({ day: DAYS[d], from, to, kind, name });
      return [d, from, to];
    }
    return null;
  };
  const placeAny = (days, slots, kind, name) => {
    for (const d of days) { const result = place(d, slots, kind, name); if (result) return result; }
    return null;
  };
  const opens = [[], [3], [2, 3], [1, 2, 3]][set.gb];
  opens.forEach((d, i) => {
    const n = set.gb > 1 ? ` ${'①②③'[i]}` : '';
    place(d, [[9.5, 10]], 'gbup', `공구${n} 오픈 피드`);
    place(d, [[10, 12]], 'gb', `공구${n} 오픈 대응`);
    place(d, [[19, 20], [20, 21]], 'gb', `공구${n} 정리`);
  });
  opens.forEach((d, i) => {
    const n = set.gb > 1 ? ` ${'①②③'[i]}` : '';
    const prev = Math.max(0, d - 1), earlier = Math.max(0, d - 2);
    placeAny([prev, earlier], [[9, 9.5], [13, 13.5], [12.5, 13]], 'gbup', `공구${n} 예고 피드`);
    placeAny([prev, earlier], [[15, 16], [13, 14], [16, 17]], 'gb', `오픈 피드${n} 준비`);
    placeAny([earlier, Math.max(0, earlier - 1)], [[14, 15], [15, 16], [11, 12], [16, 17]], 'gb', `예고 피드${n} 제작`);
  });
  const planned = [];
  for (let i = 0; i < set.plan; i++) {
    const result = placeAny([3, 1, 2, 0, 4].filter(d => !planned.includes(d)), [[14, 15], [15, 16], [16, 17], [11, 12]], 'plan', set.plan > 1 ? `기획 ${i + 1}` : '다음 주 기획');
    if (result) planned.push(result[0]);
  }
  const shootDays = [0, 1, 4, 2, 3].filter(d => !opens.includes(d));
  for (let i = 0; i < set.content; i++) {
    const preferred = shootDays[i % shootDays.length], label = `콘텐츠 ${i + 1}`;
    const candidates = [...new Set([preferred, ...shootDays, 5, 6])];
    let done = false;
    for (const d of candidates) {
      const duration = d === 4 ? 1 : 2;
      const shootSlots = d === 4 ? [[13, 14], [12, 13], [15, 16]] : [[13, 15], [10, 12], [15, 17]];
      for (let t = 9; t <= 21 - duration; t += 0.5) shootSlots.push([t, t + duration]);
      for (const slot of shootSlots) {
        const checkpoint = events.length;
        const shoot = place(d, [slot], 'shoot', `${label} 촬영`);
        if (!shoot) continue;
        const editSlots = d === 4 ? [[shoot[2], shoot[2] + 1], [16, 17]] : [[21, 23], [22, 24]];
        for (let t = shoot[2]; t <= 25 - duration; t += 0.5) editSlots.push([t, t + duration]);
        const edited = place(d, editSlots.filter(([from]) => from >= shoot[2]), 'edit', `${label} 편집`);
        if (edited) {
          const uploadDays = d === 4 ? [d, 5] : [...new Set([Math.min(6, d + 1), d])];
          for (const uploadDay of uploadDays) {
            const slots = [[19, 19.5], [20.5, 21], [9, 9.5], [13, 13.5]];
            for (let t = 9; t < 25; t += 0.5) slots.push([t, t + 0.5]);
            if (place(uploadDay, slots.filter(([from]) => uploadDay !== d || from >= edited[2]), 'up', `${label} 업로드`)) { done = true; break; }
          }
        }
        if (done) break;
        events.length = checkpoint;
      }
      if (done) break;
    }
  }
  return events;
}

export function validEvent(e) {
  return Boolean(e && DAYS.includes(e.day) && Object.hasOwn(KINDS, e.kind) && typeof e.name === 'string' && e.name.trim().length > 0 && e.name.length <= 160 && Number.isFinite(e.from) && Number.isFinite(e.to) && e.from >= 9 && e.to <= 25 && e.to > e.from && Number.isInteger(e.from * 2) && Number.isInteger(e.to * 2));
}
export function validStore(s) {
  return Boolean(s && s.set && Object.entries(LIMIT).every(([key, [lo, hi]]) => Number.isInteger(s.set[key]) && s.set[key] >= lo && s.set[key] <= hi) && Array.isArray(s.mine) && s.mine.length <= 500 && s.mine.every(validEvent) && Array.isArray(s.orig) && s.orig.length <= 500 && s.orig.every(validEvent));
}
export function initialStore() { return { set: { content: 3, gb: 1, plan: 1 }, mine: build({ content: 3, gb: 1, plan: 1 }), orig: ORIGINAL.map(e => ({ ...e })) }; }
export function time(t) { return `${t >= 24 ? '다음 날 ' : ''}${String(Math.floor(t) % 24).padStart(2, '0')}:${t % 1 ? '30' : '00'}`; }
