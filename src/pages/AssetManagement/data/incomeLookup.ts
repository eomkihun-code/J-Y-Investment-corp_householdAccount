export type IncomeMarket = '국내' | '미국';
export type IncomeCategory = 'Interest' | 'Dividend' | 'Rent' | 'Other';

export interface IncomeItemLookup {
  name: string;
  market: IncomeMarket;
  category: IncomeCategory;
  currency: 'KRW' | 'USD';
}

export const INCOME_ITEM_LOOKUP: IncomeItemLookup[] = [
  { name: 'KODEX 미국30년국채타겟커버드콜(합성)', market: '국내', category: 'Dividend', currency: 'KRW' },
  { name: 'KODEX 한국부동산 리츠 인프라',         market: '국내', category: 'Dividend', currency: 'KRW' },
  { name: 'KODEX 머니마켓액티브',                  market: '국내', category: 'Dividend', currency: 'KRW' },
  { name: '삼성전자',                               market: '국내', category: 'Dividend', currency: 'KRW' },
  { name: 'SGOV',                                   market: '미국', category: 'Dividend', currency: 'USD' },
  { name: 'TLT',                                    market: '미국', category: 'Dividend', currency: 'USD' },
  { name: '상가 월세',                              market: '국내', category: 'Rent',     currency: 'KRW' },
  { name: '업비트 이자',                            market: '국내', category: 'Interest', currency: 'KRW' },
  { name: '실업급여',                               market: '국내', category: 'Other',    currency: 'KRW' },
];

export const INCOME_MARKETS: IncomeMarket[] = ['국내', '미국'];

export const findIncomeItem = (name: string): IncomeItemLookup | undefined =>
  INCOME_ITEM_LOOKUP.find(item => item.name === name);
