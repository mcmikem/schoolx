# NCDC/UNEB reporting and registration references

**Reviewed:** 9 November 2026
**Purpose:** Evidence-backed product notes for SkoolMate's configurable report cards and possible UNEB workflows. This is a source register, not legal advice, an exhaustive compliance audit, or evidence that SkoolMate is approved by MoES, NCDC, or UNEB.

## Confirmed NCDC report-card guidance

NCDC published a letter to head teachers of government and private secondary schools titled **“Guidance on Reporting Learner Achievement in End of Year Assessment Under the New Lower Secondary Curriculum”**, dated 7 November 2022. It says the sample end-of-year report card is intended to report learner competency achievement descriptively and incorporates:

- a third-term formative report;
- an end-of-year summary with formative score weighted at 20%, end-of-year summative score weighted at 80%, and total score out of 100%;
- an eight-level grading scale A*, A, B, C, D, E, F, G, together with descriptors and score ranges.

This document supports a configurable lower-secondary end-of-year format. It does **not** establish one universal report-card template or grading scale for primary, all secondary years, other assessment periods, or every school. SkoolMate should preserve the source and curriculum level against each template, allow school-approved assessment configurations where permitted, and avoid labelling a generated form “official” unless the responsible authority confirms that exact use.

NCDC's 2023 *Evaluation Guidelines for National Curriculum Development* address evaluation of curricula and curriculum support materials. They are not, by themselves, a general approval rule for school administration software or proof that SkoolMate needs or has product certification.

NCDC's FAQ says assessment under the revised curriculum is formative and summative, and competency-focused. For S4, it says formative assessment contributes to the end-of-cycle score. These statements do not prescribe the same report layout or weighting for every level.

## UNEB registration and data exchange

No current primary-source specification for a third-party school-management-system integration, API, bulk-upload schema, or universal e-registration field set has been verified in this review. Do not treat the older candidate fields, fee figures, status flow, or claims in earlier drafts as current official requirements until checked against UNEB's current candidate-registration instructions for the relevant examination year and school category.

Before building a direct integration, obtain UNEB's written confirmation of:

1. applicable current candidate registration procedures and deadlines;
2. the approved system, file format, validation rules, and whether external software may create/import records;
3. permitted handling and transfer of candidate personal data and photographs;
4. examination-specific fees and correction/cancellation procedures.

Until confirmed, SkoolMate can prepare an internal review/export workflow, but should not claim direct UNEB integration or submission acceptance.

## Product implications

- Keep report-card settings inside the report-card workflow, as implemented in the current local page.
- Bind templates to education level, curriculum, assessment period, configured components, and an identified source/version.
- Keep source-backed NCDC formats distinct from school-defined formats; show the source and review date in the template details.
- Keep missing marks distinct from a genuine zero; the PDF helper now prints absent marks as a dash.
- Do not hard-code unverified 80/20 weighting, grade bands, fees, or candidate fields globally.
- Ask NCDC/UNEB/MoES to confirm any required templates and third-party integration process before describing the product as compliant or endorsed.

## Primary sources

1. NCDC, [Guidance on Reporting Learner Achievement in End of Year Assessment under the New Lower Secondary Curriculum](https://ncdc.go.ug/wp-content/uploads/2024/02/NCDC-Guidance_on_End_of_Year_Report_card-S1-S2-2022.pdf), dated 7 November 2022. Direct primary-source letter and sample guidance for the stated lower-secondary context.
2. NCDC, [Evaluation Guidelines for National Curriculum Development (2023)](https://ncdc.go.ug/wp-content/uploads/2024/06/EVALUATION-GUIDELINES-FOR-NATIONAL-CURRICULUM-DEVELOPMENT-2023.pdf). Scope concerns evaluation of curricula and curriculum support materials.
3. NCDC, [FAQ](https://ncdc.go.ug/faq/). Includes NCDC explanations of assessment and competency focus in the revised curriculum.
4. NCDC, [Assessment Framework for Advanced Secondary Curriculum (2026)](https://ncdc.go.ug/wp-content/uploads/2026/07/ASSESSMENT-FRAMEWORK-FOR-ADVANCED-SECONDARY-CURRICULUM-2026_Web-file.pdf), listed in NCDC's official resources. Review the relevant subject-specific assessment guideline before implementing any A-level-specific report behavior.

**Next verification:** Contact NCDC/UNEB/MoES for the currently applicable report-card templates and written clarification on third-party e-registration/data exchange. Record their response and any superseding source here before marking the integration requirement complete.
