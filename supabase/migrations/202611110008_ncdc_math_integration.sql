-- NCDC Mathematics Lower Secondary integration (Pilot: Senior 1, Term 1)
-- Maps NCDC syllabus topics to lesson_plans for pilot use.
-- NCDC Mathematics Lower Secondary Syllabus (2024 revision)
-- Senior 1 covers Numbers, Geometry and Measures, Data and Probability, Patterns & Algebra
-- Each topic has a recommended number of periods per term.
--
-- This migration seeds the first term's topics as lesson plan entries.
-- Further terms and subjects can be added in subsequent migrations.
--
-- Uses the first school, first mathematics subject (by id order), and first Primary class.

-- Ensure the lesson_plans table exists with the expected columns (verified via earlier migration)
-- Columns used: topic, lesson_title, objectives, materials, procedure, duration, term, academic_year,
--                week_number, lesson_number, subtopics, materials_needed, assessment,
--                status, teaching_method, homework

-- Pilot context: first school, first mathematics subject (by id order), first Primary class

-- ============================================================
-- Senior 1 Mathematics, Term 1 topics (NCDC curriculum)
-- ============================================================

-- Topic 1: Number Bases
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Number Bases',
  'Number Bases',
  'Understand base systems and convert between bases',
  'Whiteboard, base conversion charts',
  'Introduce base 2, 5, 8, 10; guided conversion exercises',
  45, 1, '2025-01-01', 1, 1,
  'Binary, ternary, base conversions',
  'Base conversion charts, practice problems',
  'Identify base and convert number',
  'active', 'exposition', 'base conversion worksheet'
);

-- Topic 2: Working with Integers
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Working with Integers',
  'Working with Integers',
  'Perform operations with integers (addition, subtraction, multiplication, division)',
  'Number line, integer chips, worksheets',
  'Rules for integer operations; real-world temperature problems',
  50, 1, '2025-01-01', 1, 2,
  'Integers, absolute value, operations',
  'Integer number line, worksheet problems',
  'Add, subtract, multiply, divide integers',
  'active', 'guided practice', 'integer worksheet'
);

-- Topic 3: Fractions, Percentages and Decimals
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Fractions, Percentages and Decimals',
  'Fractions, Percentages and Decimals',
  'Convert between fractions, percentages, and decimals; compare values',
  'Fraction circles, percentage bars, decimal grids',
  'Review fraction operations; percent proportion; decimal place value',
  40, 1, '2025-01-01', 1, 3,
  'Fractions, percentages, decimals, conversion',
  'Fraction circles, percentage bars, worksheets',
  'Convert between forms; compare values',
  'active', 'interactive discussion', 'conversion worksheet'
);

-- Topic 4: Rectangular Cartesian Coordinates in 2 Dimensions
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Rectangular Cartesian Coordinates in 2 Dimensions',
  'Rectangular Cartesian Coordinates in 2 Dimensions',
  'Plot points, identify coordinates, understand the Cartesian plane',
  'Graph paper, coordinate axes, rulers',
  'Introduce origin, x- and y-axes; plot points; quadrants',
  45, 1, '2025-01-01', 1, 4,
  'Cartesian plane, ordered pairs, quadrants',
  'Graph paper, rulers, coordinate grid handout',
  'Plot points; identify coordinates; quadrant location',
  'active', 'hands-on activity', 'coordinate plotting exercise'
);

-- Topic: General Angle Properties of Geometric Figures
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'General Angle Properties of Geometric Figures',
  'General Angle Properties of Geometric Figures',
  'Identify angle relationships, complementary and supplementary angles',
  'Protractors, angle diagrams, geometric software',
  'Angle measurement; complementary/supplementary angles; angle properties',
  40, 1, '2025-01-01', 1, 5,
  'Angles, complementary, supplementary, vertical',
  'Protractors, angle diagrams',
  'Identify angle relationships; calculate missing angles',
  'active', 'direct instruction', 'angle measurement worksheet'
);

-- Topic 6: Patterns and Sequence
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Patterns and Sequence',
  'Patterns and Sequence',
  'Recognize and extend numerical and geometric patterns',
  'Pattern blocks, sequence charts, algebra tiles',
  'Arithmetic sequences; geometric sequences; recursive formulas',
  40, 1, '2025-01-01', 1, 6,
  'Arithmetic sequence, geometric sequence, recursion',
  'Pattern blocks, sequence charts',
  'Find next term; explicit and recursive formulas',
  'active', 'discovery learning', 'pattern worksheet'
);

-- Topic 7: Geometric Construction Skills
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Geometric Construction Skills',
  'Geometric Construction Skills',
  'Construct geometric figures using compass and straightedge',
  'Compass, straightedge, geometric construction paper',
  'Perpendicular bisector; angle bisector; parallel line construction',
  50, 1, '2025-01-01', 1, 7,
  'Compass, straightedge, construction techniques',
  'Compass, straightedge, construction paper',
  'Construct perpendicular bisector; angle bisector',
  'active', 'hands-on construction', 'construction exercise'
);

-- Topic 8: Bearings
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Bearings',
  'Bearings',
  'Understand and use bearings for navigation and direction',
  'Protractors, bearing diagrams, map exercises',
  'Three-figure bearings; back bearings; solve navigation problems',
  45, 1, '2025-01-01', 1, 8,
  'Bearings, three-figure bearings, navigation',
  'Protractors, bearing diagram handouts, maps',
  'Read and measure bearings; solve navigation problems',
  'active', 'real-world application', 'bearing worksheet'
);

-- Topic 9: Algebra
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Algebra',
  'Algebra',
  'Simplify algebraic expressions; solve linear equations',
  'Algebra tiles, variable cards, equation mats',
  'Combine like terms; inverse operations; balance method',
  45, 1, '2025-01-01', 1, 9,
  'Algebraic expressions, linear equations, variables',
  'Algebra tiles, equation mats, worksheets',
  'Simplify expressions; solve one-variable equations',
  'active', 'guided practice', 'algebra worksheet'
);

-- Topic 10: Business Arithmetic 1
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Business Arithmetic 1',
  'Business Arithmetic 1',
  'Understand profit, loss, and simple budgeting concepts',
  'Play money, budget worksheets, real-price examples',
  'Profit and loss calculations; budgeting basics; cost analysis',
  40, 1, '2025-01-01', 1, 10,
  'Profit, loss, cost, revenue, budgeting',
  'Play money, budget worksheets, price tags',
  'Calculate profit/loss; simple budgeting',
  'active', 'real-world math', 'budget worksheet'
);

-- Topic 11: Time and Time Tables
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Time and Time Tables',
  'Time and Time Tables',
  'Read clocks; calculate time intervals; understand time tables',
  'Analog and digital clocks, time interval worksheets',
  'Tell time; calculate time differences; 24-hour clock',
  40, 1, '2025-01-01', 1, 11,
  'Clocks, time intervals, 24-hour clock',
  'Analog and digital clocks, worksheet',
  'Read clocks; calculate time differences',
  'active', 'drill practice', 'time worksheet'
);

-- Topic 12: Relations, Mapping, and Functions
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Relations, Mapping, and Functions',
  'Relations, Mapping, and Functions',
  'Understand relations, mappings, and functions; domain and range',
  'Mapping diagrams, function machines, coordinate plane',
  'Domain and range; function notation; vertical line test',
  45, 1, '2025-01-01', 1, 11,
  'Relations, mappings, functions, domain, range',
  'Mapping diagrams, function machines, coordinate grid',
  'Identify functions; state domain and range',
  'active', 'interactive discussion', 'function identification worksheet'
);

-- Topic 14: Graphs
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Graphs',
  'Graphs',
  'Plot and interpret linear and non-linear graphs',
  'Graph paper, graphing calculators, function tables',
  'Coordinate plotting; slope; y-intercept; linear vs nonlinear',
  45, 1, '2025-01-01', 1, 13,
  'Graphs, linear, nonlinear, slope, y-intercept',
  'Graph paper, graphing calculators, function tables',
  'Plot points; identify slope and intercept',
  'active', 'graphing activity', 'graphing exercise'
);

-- Topic 15: Numerical Concepts
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Numerical Concepts',
  'Numerical Concepts',
  'Review and consolidate numerical concepts from earlier topics',
  'Review sheets, calculators, number lines',
  'Review of integers, fractions, decimals, percentages',
  40, 1, '2025-01-01', 1, 14,
  'Integers, fractions, decimals, percentages',
  'Review sheets, calculators',
  'Consolidate numerical skills',
  'active', 'review session', 'review worksheet'
);

-- Topic 16: Set Theory
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Set Theory',
  'Set Theory',
  'Understand sets, unions, intersections, and complements',
  'Venn diagrams, set notation, practice problems',
  'Sets; unions; intersections; complements; Venn diagrams',
  40, 1, '2025-01-01', 1, 15,
  'Sets, unions, intersections, complements',
  'Venn diagrams, set notation cards',
  'Identify sets; compute unions and intersections',
  'active', 'direct instruction', 'set theory worksheet'
);

-- Topic 17: Equation of a Straight Line
INSERT INTO lesson_plans (
  school_id, subject_id, class_id, topic, lesson_title, objectives,
  materials, procedure, duration, term, academic_year,
  week_number, lesson_number, subtopics, materials_needed, assessment, status, teaching_method, homework
) VALUES (
  (SELECT id FROM schools ORDER BY id LIMIT 1),
  (SELECT id FROM subjects ORDER BY id LIMIT 1),
  (SELECT id FROM classes ORDER BY id LIMIT 1),
  'Equation of a Straight Line',
  'Equation of a Straight Line',
  'Derive and use the equation of a line; slope-intercept form',
  'Graph paper, slope formula, line equations',
  'Slope formula; point-slope form; slope-intercept form y = mx + b',
  45, 1, '2025-01-01', 1, 16,
  'Straight line, slope, y-intercept, linear equation',
  'Graph paper, slope formula',
  'Find slope; write equation in slope-intercept form',
  'active', 'guided practice', 'line equation worksheet'
);