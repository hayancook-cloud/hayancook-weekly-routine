// 월요일 시작 달력의 날짜와 반복 루틴 요일을 계산한다.
import { DAYS } from './routine.js';

export function monthCells(year, month) {
  const count = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const date = index - offset + 1;
    return date < 1 || date > count ? null : { date, day: DAYS[index % 7] };
  });
}
