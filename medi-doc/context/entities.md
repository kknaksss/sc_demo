# 가상회사 엔티티 사전 (SSOT)

> **목적**: 가상회사 합성 문서(pdf/xlsx/docx)의 단일 진실 공급원(Single Source of Truth).
> 2단계 워커는 이 파일의 **확정 값**을 그대로 참조해 모든 문서가 상호 정합(같은 회사명·제품·PO번호·계좌가 일관 등장)하도록 한다.
>
> ★ **전부 가짜다.** 실존 회사·브랜드·인물과 무관하게 새로 발명한 값. 도메인만 일반 차용:
> "한국산 의료미용 주사제 계열 제품을 동남아(태국)로 수입·유통하는 무역/유통 기업".
>
> 입력: `reports/PLAN-007-T-001-api.md` (문서 유형·구조 템플릿·가상회사 윤곽).

---

## 0. 비즈니스 한 줄 요약

한국 제조사(다온바이오팜)가 만든 **의료미용 주사제 3종**(보툴리눔 톡신 / HA 필러 / 스킨부스터)을,
태국 현지 법인(**오로라 메디뷰티**)이 **수입·인허가·유통**하여 현지 **클리닉**에 영업한다.
한국 **마케팅/MSO 파트너**(서울글로우파트너스)가 마케팅·콘텐츠를 지원한다.

가치사슬: 공급계약(제조사↔유통사) → 발주/결제(PO·견적·인보이스) → 수입·인허가(등록·라이선스) → 품질문서(MSDS·CoA) → 현지 영업(견적·송장) → 마케팅(소개서·카탈로그).

---

## 1. 회사 (가짜)

### 1-1. 우리 회사 — 현지 수입·유통 법인 (주체)

| 항목 | 값 |
|------|-----|
| 상호(국문) | 오로라 메디뷰티 (타일랜드) 주식회사 |
| 상호(영문) | Aurora Medibeauty (Thailand) Co., Ltd. |
| 약칭 | Aurora MB |
| 사업자/납세번호(태국 13자리 포맷) | 0-1055-87231-44-2 |
| 주소(영문) | 188/21 Ratchada Business Tower, 14th Fl., Ratchadaphisek Rd., Huai Khwang, Bangkok 10310, Thailand |
| 주소(태국어) | 188/21 อาคารรัชดาบิสซิเนสทาวเวอร์ ชั้น 14 ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310 |
| 대표(CEO) | 정해린 / Harin Jung |
| 설립일 | 2018-03-12 |
| 자본금 | THB 10,000,000 |
| 임직원수 | 24 |
| 웹사이트 | www.auroramedibeauty.co.th |
| 대표 전화 | +66 2 555 0182 |
| 대표 이메일 | contact@auroramb.co.th |
| 이메일 도메인 | @auroramb.co.th |

### 1-2. 한국 제조사 — 공급계약 상대(공급자)

| 항목 | 값 |
|------|-----|
| 상호(국문) | 다온바이오팜 주식회사 |
| 상호(영문) | Daon Biopharm Co., Ltd. |
| 사업자등록번호(한국 10자리 포맷) | 312-86-40517 |
| 주소(영문) | 42, Biovalley-ro, Osong-eup, Cheongju-si, Chungcheongbuk-do, Republic of Korea |
| 대표 | 문상혁 / Sanghyeok Moon |
| 수출 담당 | 한지우 / Jiwoo Han — export@daonbiopharm.co.kr |
| 대표 전화 | +82-43-270-5500 |
| 역할 | 제품 생산·품질관리·납품 (공급계약상 "공급자") |

### 1-3. 한국 마케팅 / MSO 파트너

| 항목 | 값 |
|------|-----|
| 상호(국문) | 서울글로우파트너스 주식회사 |
| 상호(영문) | Seoul Glow Partners Co., Ltd. |
| 주소(영문) | 7F, Glow Building, 311 Eonju-ro, Gangnam-gu, Seoul, Republic of Korea |
| 대표 | 양수빈 / Subin Yang |
| 역할 | 해외 마케팅·콘텐츠·인플루언서/라이브, 신규 클리닉 컨설팅 |
| 연락 | partner@seoulglow.co.kr |

---

## 2. 제품 3종 (가짜) — `medi-doc/product/` 폴더가 이 3개로 생성됨

> product-slug = 폴더명(영문 kebab-case). SKU/등록번호/단가대는 문서 생성 시 그대로 사용.

### 2-1. 보툴리눔 톡신 타입 A 주사제

| 항목 | 값 |
|------|-----|
| product-slug (폴더명) | `lumeitox-inj-100u` |
| 브랜드/제품명(국문) | 루메이톡스 주 100단위 |
| 브랜드/제품명(영문) | Lumeitox Inj. 100 Units |
| 수출명(Export Name) | LMTX Inj. 100 Units |
| 주성분(일반 물질군) | Clostridium botulinum toxin type A |
| SKU/품목코드 | LMTX-100U |
| 카테고리 | 의료미용 주사제 (보툴리눔 톡신, 전문의약품) |
| 규격 | 100 Units / vial (동결건조 분말, lyophilisate for solution for injection) |
| 등록/허가번호(태국 포맷) | 1C 22/68 (AU) |
| 적응증(일반 서술) | 성인 미간·눈가·이마 주름 개선 |
| 단가대 (B2B, THB) | 1,150 ~ 1,450 / vial |

### 2-2. 히알루론산(HA) 더말 필러

| 항목 | 값 |
|------|-----|
| product-slug (폴더명) | `dermaluxe-ha-filler` |
| 브랜드/제품명(국문) | 더마럭스 HA 필러 |
| 브랜드/제품명(영문) | Dermaluxe HA Filler |
| 주성분(일반 물질군) | Cross-linked hyaluronic acid (24 mg/mL) |
| SKU/품목코드 | DLX-HA-10 |
| 카테고리 | 의료미용 주사제 (HA 필러, 의료기기) |
| 규격 | 1.0 mL prefilled syringe (개당), 박스 2 syringe + 2 needle |
| 등록/허가번호(태국 의료기기 포맷) | TMD 65/2-0418 |
| 용도(일반 서술) | 안면 주름·볼륨 보정 |
| 단가대 (B2B, THB) | 900 ~ 1,200 / syringe |

### 2-3. 스킨부스터

| 항목 | 값 |
|------|-----|
| product-slug (폴더명) | `glowvita-skinbooster` |
| 브랜드/제품명(국문) | 글로우비타 스킨부스터 |
| 브랜드/제품명(영문) | Glowvita Skin Booster |
| 주성분(일반 물질군) | Polynucleotide (PN) + hyaluronic acid complex |
| SKU/품목코드 | GLV-SB-20 |
| 카테고리 | 의료미용 주사제 (스킨부스터) |
| 규격 | 2.0 mL vial × 5 / box |
| 등록/허가번호(태국 포맷) | 1C 7/68 (AU) |
| 용도(일반 서술) | 피부 보습·결 개선 |
| 단가대 (B2B, THB) | 720 ~ 980 / vial |

---

## 3. 임직원 (가짜 PII, 8명) — 이메일 도메인 `@auroramb.co.th`

| 직원ID | 이름(영문) | 이메일 | 역할 | Admin |
|--------|-----------|--------|------|-------|
| EMP-01 | 정해린 / Harin Jung | harin.jung@auroramb.co.th | 대표 (CEO / Managing Director) | ✅ |
| EMP-02 | 권도윤 / Doyun Kwon | doyun.kwon@auroramb.co.th | 영업총괄 (Sales Director) | |
| EMP-03 | 이서준 / Seojun Lee | seojun.lee@auroramb.co.th | 물류·통관 (Logistics & Import) | |
| EMP-04 | Nattaporn Srisai | nattaporn.s@auroramb.co.th | 영업 (Sales, 현지) | |
| EMP-05 | Kanya Phakdee | kanya.p@auroramb.co.th | 마케팅 (Marketing) | |
| EMP-06 | Somchai Rattana | somchai.r@auroramb.co.th | QA·인허가 (QA / RA) | |
| EMP-07 | Pimchanok Thong | pim.t@auroramb.co.th | 회계 (Accounting) | ✅ |
| EMP-08 | Weerapong Noi | wee.n@auroramb.co.th | 고객지원 (CS) | |

> 공용 메일박스(소개서/송장 푸터용): acc@auroramb.co.th, info@auroramb.co.th, marketing@auroramb.co.th

---

## 4. 거래처 & 은행 (가짜)

### 4-1. 최종 거래처 클리닉

| 거래처ID | 상호(영문) | 지역 | 비고 |
|----------|-----------|------|------|
| CL-001 | Radiance Skin Clinic | Bangkok (Sukhumvit) | 주력 거래처 |
| CL-002 | Bloom Aesthetic Clinic | Chiang Mai | |
| CL-003 | Velvet Derma Center | Phuket | |
| CL-004 | Lumière Beauty Clinic | Bangkok (Thonglor) | |
| CL-005 | Siam Glow Clinic | Bangkok (Siam) | |

### 4-2. 은행/계좌 (전부 가짜)

| 용도 | 은행 | 계좌번호 | 예금주 | SWIFT |
|------|------|----------|--------|-------|
| 우리 회사 수금(THB) | Bangkok Commercial Bank | 123-4-56789-0 | Aurora Medibeauty (Thailand) Co., Ltd. | BKCBTHBK |
| 제조사 수취(KRW, 수입대금) | Hangang Bank | 110-234-567890 | Daon Biopharm Co., Ltd. | HGBKKRSE |
| 마케팅 정산(KRW) | Hangang Bank | 110-987-654321 | Seoul Glow Partners Co., Ltd. | HGBKKRSE |

---

## 5. 문서번호 & 키 체계 (정합성용)

> 2단계에서 각 문서가 아래 규칙으로 번호를 **발급**한다. 같은 거래 1건은 PO→견적→인보이스가 같은 시퀀스 번호로 묶이게 한다(예: `-001` 끼리).

### 5-1. 문서번호 포맷

| 문서 | 포맷 | 예시 |
|------|------|------|
| 발주서 (PO) | `PO-YYYY-NNN` | PO-2024-001 |
| 견적서 (Quotation) | `QT-YYYY-NNN` | QT-2024-001 |
| 인보이스 (Invoice) | `INV-YYYY-NNN` | INV-2024-001 |
| 상업송장 (Commercial Invoice) | `CI-YYYYMMDD-NN` | CI-20240603-01 |
| 공급계약서 | `SA-YYYY-NN` | SA-2023-01 |
| 제품 등록번호 | 제품별 (§2 참조) | 1C 22/68 (AU) |
| 시험성적서 (CoA) | `COA-{SKU}-{LOT}` | COA-LMTX100U-L2406A |
| 배치/로트 (Lot) | `L{YYMM}{A..Z}` | L2406A |

### 5-2. 엔티티 키 (→ 이후 온톨로지 엔티티/관계 키로 직결)

| 엔티티 | 키 체계 | 값 |
|--------|---------|-----|
| 회사 | `ORG-{slug}` | ORG-aurora-mb / ORG-daon-biopharm / ORG-seoul-glow |
| 제품 | SKU | LMTX-100U / DLX-HA-10 / GLV-SB-20 |
| 거래처 | `CL-NNN` | CL-001 ~ CL-005 |
| 직원 | `EMP-NN` | EMP-01 ~ EMP-08 |
| 거래(트랜잭션) | `TXN-YYYY-NNN` | TXN-2024-001 (PO/견적/인보이스 묶음 키) |

### 5-3. 통화·기준

- 거래 통화: 영업(현지 클리닉)=THB, 수입대금(제조사)=USD 또는 KRW.
- 환율 표기 필요 시 데모용 고정값: 1 USD ≈ 36 THB ≈ 1,350 KRW (실측 아님, 합성 일관성용).
- 결제 조건 기본값: T/T in advance 30% / balance before shipment (계약 부대합의서·인보이스 공통).

---

## 부록 — 2단계 사용 가이드(요약)

- `medi-doc/product/{product-slug}/` 3개 폴더 생성 → 각 폴더에 해당 제품의 MSDS·CoA·등록조회·카탈로그 합성.
- 공통(회사 단위) 문서(공급계약서·임직원 명부·회사소개서·영업시트)는 `medi-doc/context/` 또는 별도 공통 폴더.
- 모든 문서의 회사/제품/인명/계좌/번호는 **반드시 본 사전 값만** 사용 (새 값 임의 생성 금지 — 정합성 깨짐).
- DOC-13(개인 회계·경비) 유형은 민감도 사유로 데모 제외 또는 구조만 모사한 완전 가공표.
