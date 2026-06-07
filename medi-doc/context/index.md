# context — 회사 단위 문서 맵

오로라 메디뷰티의 **회사 전반 문서**(소개서·계약·매출·임직원·거래주체)와 기준 사전이 모여 있습니다.
제품·거래 단위 문서는 [../product/index.md](../product/index.md) 로 가세요.

## 기준 사전

| 파일 | 포맷 | 한 줄 요약 | 언제 참조 |
|------|------|-----------|-----------|
| [entities.md](entities.md) | md | SSOT 사전 — 회사·제품·거래처·임직원·문서번호 체계의 기준 값 | 다른 모든 문서의 값이 이 파일을 참조. 값 충돌 시 최우선 |

## 회사 소개서

| 파일 | 포맷 | 한 줄 요약 | 언제 참조 |
|------|------|-----------|-----------|
| [company-profile.pdf](company-profile.pdf) | pdf | 오로라 메디뷰티(유통사) 회사소개서 — 설립·사업영역·연락처 | 회사 개요·연혁·주소가 필요할 때 |
| [company-profile-daon.pdf](company-profile-daon.pdf) | pdf | 다온바이오팜(한국 제조사) 소개서 | 제품 제조·공급자 정보가 필요할 때 |
| [company-profile-sgp.pdf](company-profile-sgp.pdf) | pdf | 서울글로우파트너스(마케팅 파트너) 소개서 | 마케팅·MSO 파트너 정보가 필요할 때 |

## 공급 계약

| 파일 | 포맷 | 한 줄 요약 | 언제 참조 |
|------|------|-----------|-----------|
| [supply-agreement.docx](supply-agreement.docx) | docx | 공급계약서 국문 (SA-2023-01, 다온↔오로라, 18조항+부대합의서 3제품) | 단가·결제조건·공급 조건이 필요할 때 |
| [supply-agreement-en.docx](supply-agreement-en.docx) | docx | 위 계약의 영문본 (동일 SA-2023-01) | 영문 계약 조항이 필요할 때 |

## 매출 시트

| 파일 | 포맷 | 한 줄 요약 | 언제 참조 |
|------|------|-----------|-----------|
| [sales-forecast.xlsx](sales-forecast.xlsx) | xlsx | 제품별 월별 매출 예측 (3시트) | 제품별 예측·계획 수치가 필요할 때 |
| [sales-annual.xlsx](sales-annual.xlsx) | xlsx | 2024 연간 통합 매출 (Summary / Quarterly / By-Clinic 3시트) | 연간·분기·거래처별 매출 집계가 필요할 때 |

## 임직원·거래주체

| 파일 | 포맷 | 한 줄 요약 | 언제 참조 |
|------|------|-----------|-----------|
| [employees.md](employees.md) | md | 임직원 8명 명부 — 이메일(@auroramb.co.th)·역할 | 담당자·연락처가 필요할 때 |
| [employees.pdf](employees.pdf) | pdf | 위 명부의 PDF 사본 | 인쇄·배포용 동일 내용 |
| [partners.md](partners.md) | md | 거래 주체 정리 — 제조사·마케팅 파트너·클리닉 5곳 | 거래 상대 회사/거래처를 한눈에 볼 때 |

## 연관성

- [supply-agreement.docx](supply-agreement.docx) 의 제품·단가 ↔ [entities.md](entities.md) §2 ↔ [sales-annual.xlsx](sales-annual.xlsx) ↔ 각 제품 거래내역 [../product/index.md](../product/index.md)
- [company-profile-daon.pdf](company-profile-daon.pdf) (제조사) → 각 제품의 제조·품질 문서(`../product/{slug}/coa.pdf`, `msds.pdf`)
- [partners.md](partners.md) 의 클리닉 CL-001~005 → 각 제품 `../product/{slug}/index.md` 의 거래(TXN) 거래처
