// 금액 입력창용 유틸
// 내부 상태는 콤마 없는 순수 숫자 문자열로 유지하고, 화면에만 천단위 콤마를 붙인다.

/** 사용자가 입력한 값에서 숫자와 소수점만 남긴다. (소수점은 1개, 소수 2자리까지) */
export function sanitizeNumberInput(value: string, allowDecimal = true): string {
  const cleaned = value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (!allowDecimal) return cleaned;

  const [head, ...tail] = cleaned.split('.');
  if (tail.length === 0) return head;
  return `${head}.${tail.join('').slice(0, 2)}`;
}

/** 순수 숫자 문자열에 천단위 콤마를 붙여 화면 표시용 문자열을 만든다. */
export function formatNumberInput(value: string): string {
  if (!value) return '';

  const [head, decimal] = value.split('.');
  const formattedHead = head ? Number(head).toLocaleString('en-US') : '';
  return value.includes('.') ? `${formattedHead}.${decimal ?? ''}` : formattedHead;
}

/** 콤마가 섞인 문자열을 숫자로 변환한다. 비어있거나 숫자가 아니면 NaN. */
export function parseNumberInput(value: string): number {
  return parseFloat(String(value).replace(/,/g, ''));
}
