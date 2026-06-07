# 거래 주체 명부 (Partners) — Aurora Medibeauty

> 회사 단위 합성 문서. 전부 가짜 데이터. 출처: `entities.md` §1(회사)·§4-1(클리닉)·§5-2(키 체계).
> 가치사슬: 제조사(다온바이오팜) → 유통사(오로라 메디뷰티) → 클리닉 5곳. 마케팅은 서울글로우파트너스가 지원.

## 1. 주체 회사 (우리)

| 항목 | 값 |
|------|-----|
| 키 | `ORG-aurora-mb` |
| 상호(국문) | 오로라 메디뷰티 (타일랜드) 주식회사 |
| 상호(영문) | Aurora Medibeauty (Thailand) Co., Ltd. (약칭 Aurora MB) |
| 역할 | 현지 수입·인허가·유통 (공급계약상 "구매자/유통사") |
| 대표 | 정해린 / Harin Jung |
| 주소 | 188/21 Ratchada Business Tower, 14th Fl., Ratchadaphisek Rd., Huai Khwang, Bangkok 10310, Thailand |
| 납세번호 | 0-1055-87231-44-2 |
| 연락 | contact@auroramb.co.th · +66 2 555 0182 |

## 2. 거래 파트너 회사

### 2-1. 제조사 (공급자)

| 항목 | 값 |
|------|-----|
| 키 | `ORG-daon-biopharm` |
| 상호 | 다온바이오팜 주식회사 / Daon Biopharm Co., Ltd. |
| 역할 | 제품 생산·품질관리·납품 (공급계약상 "공급자") |
| 사업자등록번호 | 312-86-40517 |
| 주소 | 42, Biovalley-ro, Osong-eup, Cheongju-si, Chungcheongbuk-do, Republic of Korea |
| 대표 | 문상혁 / Sanghyeok Moon |
| 수출 담당 | 한지우 / Jiwoo Han — export@daonbiopharm.co.kr |
| 대표 전화 | +82-43-270-5500 |

### 2-2. 마케팅 / MSO 파트너

| 항목 | 값 |
|------|-----|
| 키 | `ORG-seoul-glow` |
| 상호 | 서울글로우파트너스 주식회사 / Seoul Glow Partners Co., Ltd. |
| 역할 | 해외 마케팅·콘텐츠·인플루언서/라이브, 신규 클리닉 컨설팅 |
| 주소 | 7F, Glow Building, 311 Eonju-ro, Gangnam-gu, Seoul, Republic of Korea |
| 대표 | 양수빈 / Subin Yang |
| 연락 | partner@seoulglow.co.kr |

## 3. 최종 거래처 클리닉 (5곳)

| 거래처ID | 상호(영문) | 지역 | 비고 |
|----------|-----------|------|------|
| CL-001 | Radiance Skin Clinic | Bangkok (Sukhumvit) | 주력 거래처 |
| CL-002 | Bloom Aesthetic Clinic | Chiang Mai | |
| CL-003 | Velvet Derma Center | Phuket | |
| CL-004 | Lumière Beauty Clinic | Bangkok (Thonglor) | |
| CL-005 | Siam Glow Clinic | Bangkok (Siam) | |

## 4. 키 체계 (정합성용 · `entities.md` §5-2)

| 엔티티 | 키 체계 | 값 |
|--------|---------|-----|
| 회사 | `ORG-{slug}` | ORG-aurora-mb / ORG-daon-biopharm / ORG-seoul-glow |
| 거래처 | `CL-NNN` | CL-001 ~ CL-005 |
| 직원 | `EMP-NN` | EMP-01 ~ EMP-08 (→ employees.md) |
| 제품 | SKU | LMTX-100U / DLX-HA-10 / GLV-SB-20 |
