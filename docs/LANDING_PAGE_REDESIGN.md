# Landing Page Design: Professional Transformation Outline

## 1. Hero Section (The "Value Hook")
- **Headline**: Must focus on outcome. Example: "Complete School Visibility, Simplified."
- **Sub-headline**: Brief explanation. "The all-in-one operating system for schools that helps you spend less time on admin and more on students."
- **Primary CTA**: "Start Your 14-Day Free Trial" (High contrast).
- **Secondary CTA**: "Watch 2-Min Product Overview" (Link).
- **Social Proof**: "Used by 50+ schools to manage daily operations."

## 2. The "Pain Point" Solution Section (The "Why")
- **The Problem**: Use 3 cards highlighting the three biggest problems: "Lost Records," "Delayed Decisions," "Inefficient Communication."
- **The Result**: Briefly state how SchoolX fixes them. 
- *Visual*: Keep text minimal. Icons > Long text.

## 3. Product Tour (The "How")
- **Dashboard Preview**: A single, clean, high-fidelity screenshot of the Headmaster dashboard.
- **Key Features (3 Columns)**:
    - **Academic Insight**: Attendance & Grades in one view.
    - **Financial Control**: Fee collection and automated tracking.
    - **Unified Comms**: SMS/Notices integrated with parent portals.

## 4. Trust Section (The "Why Us")
- **Testimonials**: 2-3 quotes from real headmasters.
- **Logo Strip**: "Schools running on SchoolX" (even if dummy logos for now).

## 5. Pricing Table (The "Conversion")
- **Clear Tiers**: Monthly or Termly billing options.
- **Feature Checklists**: What's included (e.g., "SMS support," "24/7 Support," "Unlimited Students").

## 6. Closing CTA
- **Headline**: "Ready to transform your school's daily operations?"
- **Primary CTA**: "Start Free Trial"
- **Footer**: Simplified links (Contact, Privacy, Terms).

---

## Strategy for Execution
- **Refactor `src/app/page.tsx`**: Replace the current 500-line monolith with these modular components.
- **Unify Style**: Apply standard CSS tokens from `globals.css` (e.g., `--navy`, `--green`, `--t1`) to make the landing page feel like part of the dashboard app.
- **Remove Distractions**: Strip out excessive mockups that take up 40% of the screen.
