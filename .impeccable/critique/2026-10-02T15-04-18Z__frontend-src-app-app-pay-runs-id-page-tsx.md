---
target: pay run detail page
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Charp\\jangna\\frontend\\src\\app\\app\\pay-runs\\[id]\\page.tsx"
target_fingerprint: "sha256:84ab095facb44be07d9100e9b5e4588ed842b55105ad399e4dbee91117c660ae"
target_path: "C:\\Charp\\jangna\\frontend\\src\\app\\app\\pay-runs\\[id]\\page.tsx"
timestamp: 2026-10-02T15-04-18Z
slug: frontend-src-app-app-pay-runs-id-page-tsx
---
# Critique: pay-runs/[id]/page.tsx

Method: dual-agent. DEGRADED (partial): neither assessor had a browser tool; rendering was not observed.

Score 20/40 (Acceptable). Heuristics: 1=2, 2=2, 3=2, 4=3, 5=1, 6=2, 7=2, 8=3, 9=2, 10=1.

Design specificity: FAIL (interchangeable admin table; core promise "explainable to the baht" is hidden behind a collapsed row; warnings are the weakest element). Detector: source clean; /login findings are false positives (cream = intended Hearth world, logo gradient exempt).

Priority issues:
- [P1] Lock ignores unreviewed warnings; confirm is a native confirm() (lines 96-97). Fix: in-app dialog with headcount, total net, warning count, pay date, "cannot be undone"; require acknowledging warnings. /impeccable harden
- [P1] Warnings buried as a tiny "warning n" badge per row (177-181, 205-211). Fix: summary banner above table, sort/filter warnings first. /impeccable layout
- [P1] Recalculate / Delete / Lock presented as equals; Delete adjacent to primary; top of screen out of thumb reach (86-102). Fix: Lock as clear accent (sticky bottom bar on mobile), others to secondary menu. /impeccable layout
- [P2] Net pay not dominant; SSO stat merges employee+employer while the column shows employee only (126-131). Fix: Net dominant, split employer cost. /impeccable typeset
- [P2] Table scrolls sideways on mobile so Net is off-screen (140-142). Fix: per-employee cards below sm. /impeccable adapt

Personas: Jordan, Casey, Sam, shop-owner-afraid-of-paying-wrong.
Minor: bare loading text, pay-date saves with no confirmation, delete uses confirm(), list warnings column is a bare number, key={w.th} may collide, aria-controls targets an id absent while collapsed, no live region for mutation results.
