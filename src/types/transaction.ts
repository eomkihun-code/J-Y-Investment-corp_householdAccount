export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // ISO string format
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  cardType?: string;
  fileName?: string;
}

// 카테고리 매핑 로직은 더이상 이곳에서 처리하지 않고 제미나이(CSV 입력단)에서 미리 할당된 값을 사용합니다.
