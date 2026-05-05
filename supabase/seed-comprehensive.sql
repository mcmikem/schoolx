-- Comprehensive seed data for Omuto Test School
-- Run: npx supabase db query --project-ref gucxpmgwvnbqykevucbi < supabase/seed-comprehensive.sql

-- Get school and class IDs for reference
-- School: 70ee855b-22f1-4b19-b71f-41882b17f260 (Omuto Test School)

-- ============================================
-- More Students (Primary Classes P.1A - P.7A)
-- ============================================

-- P.1A (30 students, ages 5-6)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Emmanuel','Grace','Faith','Daniel','Gladys','Joseph','Janet','John','Mary','Peter','Ruth','Samuel','Esther','David','Susan','Richard','Alice','Benedict','Charity','Vincent','Scovia','Alfred','Mercy','Benson','Catherine','Dorothy','Edwin','Flavia','George','Hadija'])[n],
  (ARRAY['Ouma','Nabukeera','Nakato','Wekesa','Nansubwa','Okello','Kasozi','Mukisa','Namutebi','Kaguta','Nakis','Wasswa','Luwang','Akello','Oboth','Laker','Amuge','Kagaba','Nabukeera','Musinguzi','Kyagulanyi','Nabukalu','Ssemakula','Namutebi','Opondo','Nakato','Mukisa','Wasswa','Nantongo','Kasozi'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2020-01-01' + (random() * 365 || ' days')::interval,
  '59bfb90e-82b3-49f4-b7b9-45aa3a54aad5', -- P.1A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P1A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((100000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- P.2A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Alex','Brenda','Charles','Diana','Evans','Florence','George','Hadija','Ivan','Joyce','Kenneth','Lilian','Martin','Nancy','Patrick','Queen','Robert','Sarah','Thomas','Ursula','Victor','Winfred','Xavier','Yolanda','Zachary','Agnes','Brian','Cynthia','Dennis','Evelyn'])[n],
  (ARRAY['Opio','Namuli','Kato','Nsubuga','Wafula','Mukama','Okoth','Nambalirwa','Lubega','Kagwe','Musoke','Nankinga','Wasswa','Nakiwala','Kikome','Bakabuli','Wanyama','Nabwire','Ssentamu','Kaganzi','Wandera','Nabukalu','Ssempala','Mutesasira','Lukwago','Nantanda','Muwonge','Nabiryo','Wekober','Naggayi','Kakunguru'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2019-01-01' + (random() * 365 || ' days')::interval,
  'bbb56e37-d6ca-4063-a7e3-61a54627fc8d', -- P.2A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P2A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((200000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- P.3A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Aaron','Beatrice','Caleb','Deborah','Ezekiel','Fatuma','Gabriel','Hannah','Isaac','Judith','Kelvin','Lydia','Michael','Miriam','Nelson','Olivia','Paul','Priscilla','Quincy','Rachel','Simon','Rebecca','Timothy','Ulysses','Victor','Veronica','William','Xena','Yusuf','Zara'])[n],
  (ARRAY['Masereka','Mbabazi','Kakunguru','Nassimbwa','Bugembe','Wanyana','Katende','Nankinga','Ssentamu','Namwaya','Kafeero','Nabulime','Mutesi','Wekunda','Ssebugwawo','Kagoda','Mubiru','Nabukeera','Semakula','Nyegenye','Mukisa','Nantongo','Katooke','Naggayi','Wasswa','Nakis','Ssenyonga','Nabukalu','Lukwago','Muwangi'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2018-01-01' + (random() * 365 || ' days')::interval,
  '8a0877d5-92ff-4bb1-8822-11c277c5edba', -- P.3A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P3A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((300000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- P.4A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Adrian','Brendah','Clinton','Daphne','Elijah','Fiona','Gideon','Gloria','Harrison','Irene','James','Josphine','Kevin','Katherine','Lawrence','Lillian','Mark','Michelle','Nathan','Nightingale','Oscar','Patricia','Quinn','Queenie','Ronald','Rosemary','Steve','Susan','Trevor','Tracy'])[n],
  (ARRAY['Musinguzi','Nabukalu','Okello','Nantanda','Muwonge','Nabiryo','Kafeero','Namutebi','Kasozi','Nansubwa','Wekesa','Namanda','Oboth','Nakis','Luwang','Amuge','Kagaba','Nabukeera','Ssemakula','Nkurunungi','Lukwago','Namwaya','Mubiru','Nantongo','Katende','Nankinga','Ssempala','Nabwire','Musoke','Naggayi'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2017-01-01' + (random() * 365 || ' days')::interval,
  '619ab965-a046-4e4e-a87a-df7d4681a1b2', -- P.4A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P4A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((400000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- P.5A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Allen','Betty','Collins','Dorothy','Eric','Felicia','Godfrey','Helen','Ivan','Janet','Keith','Linda','Leonard','Monica','Maxwell','Nancy','Oliver','Pamela','Peter','Queen','Richard','Rose','Sam','Tina','Tom','Ursula','Vincent','Violet','William','Wendy'])[n],
  (ARRAY['Wekesa','Nabukalu','Okwir','Nantongo','Mukisa','Namutebi','Kikome','Nankunda','Lubega','Nansubwa','Mugisha','Nabyonga','Wasswa','Nakis','Kasozi','Namanda','Oboth','Nabukeera','Lukwago','Nkurunungi','Ssemakula','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2016-01-01' + (random() * 365 || ' days')::interval,
  '6a83d705-1916-495f-b72f-378040a7b5fe', -- P.5A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P5A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((500000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- P.6A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Andrew','Brenda','Collins','Denis','Eddie','Florence','Francis','Grace','Henry','Ivy','Jack','Joy','Kenneth','Karen','Lawrence','Lilian','Martin','Mary','Nicholas','Nina','Oscar','Patience','Quincy','Rita','Solomon','Sarah','Thomas','Trust','Victor','Vicky'])[n],
  (ARRAY['Opondo','Nakato','Mugerwa','Nansubwa','Okello','Nabukeera','Wasswa','Nantongo','Kasozi','Namanda','Oboth','Nakis','Luwang','Amuge','Kagaba','Nabukalu','Ssemakula','Nkurunungi','Lukwago','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda','Musoke','Nabiryo'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2015-01-01' + (random() * 365 || ' days')::interval,
  '70aab450-41cb-4f54-a590-23753871b082', -- P.6A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P6A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((600000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- P.7A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Abraham','Beth','Charles','Diana','Eden','Favour','George','Hope','Isaac','Jane','Kelvin','Kate','Lawrence','Lydia','Moses','Magaret','Nathan','Naomi','Oscar','Ophilia','Paul','Petra','Quincy','Ruth','Samuel','Salome','Timothy','Tara','Uriah','Uma'])[n],
  (ARRAY['Okoth','Nambalirwa','Mutesi','Nankinga','Wasswa','Namwaya','Kasozi','Nansubwa','Mubiru','Nabukeera','Okello','Nantongo','Luwang','Nakis','Oboth','Nabukalu','Ssemakula','Nkurunungi','Wekesa','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda','Musoke','Nabiryo'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2014-01-01' + (random() * 365 || ' days')::interval,
  'ff179f4c-fd86-440b-b7db-39861272bdf0', -- P.7A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'P7A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((700000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- ============================================
-- Secondary Classes (S.1 - S.6, Streams A & B)
-- ============================================

-- S.1A (35 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Alan','Beatrice','Brian','Catherine','Daniel','Esther','Evans','Faith','Gabriel','Grace','Henry','Happiness','Ivan','Joy','James','Joyce','Kenneth','Lilian','Martin','Miriam','Nelson','Nightingale','Oscar','Olivia','Patrick','Priscilla','Quincy','Queen','Robert','Ruth','Samuel','Sarah','Thomas','Ursula','Victor'])[n],
  (ARRAY['Ouma','Nabukeera','Nakato','Wekesa','Nansubwa','Okello','Kasozi','Mukisa','Namutebi','Kaguta','Nakis','Wasswa','Luwang','Akello','Oboth','Laker','Amuge','Kagaba','Nabukeera','Musinguzi','Kyagulanyi','Nabukalu','Ssemakula','Namutebi','Opondo','Nakato','Mukisa','Wasswa','Nantongo','Kasozi','Masereka','Mbabazi','Kakunguru','Bugembe','Wanyana'])[n],
  CASE WHEN n <= 18 THEN 'M' ELSE 'F' END,
  DATE '2013-01-01' + (random() * 365 || ' days')::interval,
  'c4d204b1-be46-4991-bceb-fd89c6f04214', -- S.1A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S1A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((800000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 35) AS n;

-- S.1B (35 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Arnold','Brenda','Clive','Doreen','Edwin','Eunice','Felix','Flavia','George','Gladys','Herbert','Irene','Johnson','Julia','Klaus','Lillian','Leonard','Maggy','Moses','Maureen','Noah','Nora','Otto','Ouma','Peter','Peace','Quincy','Quira','Ronald','Rosette','Steve','Stella','Timothy','Tersa','Uriah','Upendo'])[n],
  (ARRAY['Masereka','Mbabazi','Kakunguru','Nassimbwa','Bugembe','Wanyana','Katende','Nankinga','Ssentamu','Namwaya','Kafeero','Nabulime','Mutesi','Wekunda','Ssebugwawo','Kagoda','Mubiru','Nabukeera','Semakula','Nyegenye','Mukisa','Nantongo','Katooke','Naggayi','Wasswa','Nakis','Ssenyonga','Nabukalu','Lukwago','Muwangi','Opio','Namuli','Kato','Nsubuga','Wafula'])[n],
  CASE WHEN n <= 18 THEN 'M' ELSE 'F' END,
  DATE '2013-01-01' + (random() * 365 || ' days')::interval,
  '5ee0f38c-40f0-4f00-b7ac-cd4844f5fd3b', -- S.1B
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S1B-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0777' || LPAD((900000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 35) AS n;

-- S.2A (35 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Allan','Beitah','Caleb','Deborah','Eliud','Faith','Felix','Gladys','Gideon','Gloria','Harrison','Halima','Isaac','Irene','John','Joy','Kelvin','Keziah','Lawrence','Lydia','Martin','Monica','Nathan','Nancy','Oscar','Ophilia','Patrick','Patience','Quincy','Rachel','Richard','Ruth','Solomon','Sarah','Timothy','Tracy'])[n],
  (ARRAY['Mukama','Okoth','Nambalirwa','Mutesi','Nankinga','Wasswa','Namwaya','Kasozi','Nansubwa','Mubiru','Nabukeera','Okello','Nantongo','Luwang','Nakis','Oboth','Nabukalu','Ssemakula','Nkurunungi','Wekesa','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda','Musoke','Nabiryo','Wekunda','Ssebugwawo','Kagoda','Mubiru'])[n],
  CASE WHEN n <= 18 THEN 'M' ELSE 'F' END,
  DATE '2012-01-01' + (random() * 365 || ' days')::interval,
  '44f22e92-4657-48df-80b0-8776d0da41cd', -- S.2A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S2A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((100000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 35) AS n;

-- S.2B (35 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Andrew','Bridget','Bruce','Caroline','Dennis','Diana','Edward','Emily','Francis','Fiona','Godfrey','Gifty','Henry','Hadija','Ivan','Ivy','James','Jasmine','Kelvin','Katherine','Leonard','Laura','Martin','Lillian','Nicholas','Nadia','Oscar','Odelia','Patrick','Priscilla','Quinn','Queency','Robert','Rebecca','Samuel','Susan'])[n],
  (ARRAY['Nabukalu','Okello','Nantongo','Mukisa','Namutebi','Kikome','Nankunda','Lubega','Nansubwa','Mugisha','Nabyonga','Wasswa','Nakis','Kasozi','Namanda','Oboth','Nabukeera','Lukwago','Nkurunungi','Ssemakula','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda','Musoke','Nabiryo','Lukwago','Nabwire','Kikome','Nankunda'])[n],
  CASE WHEN n <= 18 THEN 'M' ELSE 'F' END,
  DATE '2012-01-01' + (random() * 365 || ' days')::interval,
  'bab95fb1-7436-4cba-8bd9-7aa82e476887', -- S.2B
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S2B-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((200000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 35) AS n;

-- S.3A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Aaron','Barbara','Brian','Cynthia','David','Esther','Emmanuel','Florence','Felix','Gladys','Godfrey','Harriet','Isaac','Irene','John','Janet','Kelvin','Joy','Lawrence','Lillian','Martin','Miriam','Nathan','Nancy','Oscar','Priscilla','Patrick','Peninah','Quincy','Queen'])[n],
  (ARRAY['Opondo','Nakato','Mugerwa','Nansubwa','Okello','Nabukeera','Wasswa','Nantongo','Kasozi','Namanda','Oboth','Nakis','Luwang','Amuge','Kagaba','Nabukalu','Ssemakula','Nkurunungi','Lukwago','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda','Musoke','Nabiryo','Okoth','Nambalirwa'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2011-01-01' + (random() * 365 || ' days')::interval,
  'f34a04b9-0b59-4108-9ddf-faf887fe895a', -- S.3A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S3A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((300000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- S.3B (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Arnold','Beatrice','Clive','Dorothy','Eddie','Evelyn','Felix','Faith','George','Gloria','Herbert','Hope','Isaac','Iris','James','Jane','Kelvin','Keziah','Leonard','Lydia','Moses','Miriam','Nelson','Nightingale','Oscar','Olivia','Patrick','Petra','Quincy','Ruth'])[n],
  (ARRAY['Mutesi','Nankinga','Wasswa','Namwaya','Kasozi','Nansubwa','Mubiru','Nabukeera','Okello','Nantongo','Luwang','Nakis','Oboth','Nabukalu','Ssemakula','Nkurunungi','Wekesa','Naggayi','Mutesasira','Wanyama','Bakabuli','Nabwire','Nankinga','Katende','Mubiru','Nantanda','Musoke','Nabiryo','Wekunda','Ssebugwawo','Kasozi'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2011-01-01' + (random() * 365 || ' days')::interval,
  'eefc174a-0138-47f1-91f9-bb18ea3d5ff3', -- S.3B
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S3B-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((400000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- S.4A (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Allan','Brenda','Charles','Diana','Evans','Florence','Francis','Grace','Gabriel','Gladys','Henry','Hadija','Isaac','Irene','Joseph','Joy','Kenneth','Katherine','Lawrence','Lilian','Martin','Martha','Nelson','Olivia','Oscar','Priscilla','Patrick','Peninah','Quincy','Ruth'])[n],
  (ARRAY['Masereka','Mbabazi','Kakunguru','Nassimbwa','Bugembe','Wanyana','Katende','Nankinga','Ssentamu','Namwaya','Kafeero','Nabulime','Mutesi','Wekunda','Ssebugwawo','Kagoda','Mubiru','Nabukeera','Semakula','Nyegenye','Mukisa','Nantongo','Katooke','Naggayi','Wasswa','Nakis','Ssenyonga','Nabukalu','Lukwago','Muwangi','Opio'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2010-01-01' + (random() * 365 || ' days')::interval,
  '85eb84a3-2077-428c-90fb-98471acf026c', -- S.4A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S4A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((500000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- S.4B (30 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Aaron','Beitah','Benson','Caroline','Daniel','Deborah','Elijah','Esther','Evans','Faith','Felix','Felicia','George','Gloria','Herbert','Hope','Isaac','Ivy','James','Jasmine','Kelvin','Keziah','Lawrence','Laura','Martin','Maggy','Noah','Nora','Oscar','Peace'])[n],
  (ARRAY['Ouma','Nabukeera','Nakato','Wekesa','Nansubwa','Okello','Kasozi','Mukisa','Namutebi','Kaguta','Nakis','Wasswa','Luwang','Akello','Oboth','Laker','Amuge','Kagaba','Nabukeera','Musinguzi','Kyagulanyi','Nabukalu','Ssemakula','Namutebi','Opondo','Nakato','Mukisa','Wasswa','Nantongo','Kasozi','Masereka'])[n],
  CASE WHEN n <= 15 THEN 'M' ELSE 'F' END,
  DATE '2010-01-01' + (random() * 365 || ' days')::interval,
  '53749a8d-81d4-457e-9559-4d81a3501d71', -- S.4B
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S4B-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((600000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 30) AS n;

-- S.5A (25 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Andrew','Betty','Caleb','Cynthia','David','Diana','Edward','Emily','Felix','Florence','George','Grace','Henry','Hadija','Isaac','Irene','Joseph','Janet','Kelvin','Joy','Leonard','Lillian','Martin','Miriam','Noah'])[n],
  (ARRAY['Mbabazi','Kakunguru','Nassimbwa','Bugembe','Wanyana','Katende','Nankinga','Ssentamu','Namwaya','Kafeero','Nabulime','Mutesi','Wekunda','Ssebugwawo','Kagoda','Mubiru','Nabukeera','Semakula','Nyegenye','Mukisa','Nantongo','Katooke','Naggayi','Wasswa','Nakis','Ssenyonga'])[n],
  CASE WHEN n <= 13 THEN 'M' ELSE 'F' END,
  DATE '2009-01-01' + (random() * 365 || ' days')::interval,
  '02869885-eed9-456e-9262-5118669ef0f3', -- S.5A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S5A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((700000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 25) AS n;

-- S.5B (25 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Alan','Brenda','Collins','Deborah','Emmanuel','Esther','Francis','Felicia','Godfrey','Gladys','Harrison','Irene','Isaac','Ivy','James','Joy','Kelvin','Katherine','Lawrence','Laura','Moses','Maggy','Nathan','Nancy','Oscar'])[n],
  (ARRAY['Nakato','Wekesa','Nansubwa','Okello','Kasozi','Mukisa','Namutebi','Kaguta','Nakis','Wasswa','Luwang','Akello','Oboth','Laker','Amuge','Kagaba','Nabukeera','Musinguzi','Kyagulanyi','Nabukalu','Ssemakula','Namutebi','Opondo','Nakato','Mukisa','Wasswa'])[n],
  CASE WHEN n <= 13 THEN 'M' ELSE 'F' END,
  DATE '2009-01-01' + (random() * 365 || ' days')::interval,
  '7cd62406-f09f-42ba-a236-f3ddc5b569e2', -- S.5B
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S5B-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((800000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 25) AS n;

-- S.6A (20 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Allan','Beatrice','Caleb','Diana','Emmanuel','Esther','Felix','Florence','George','Grace','Henry','Hadija','Isaac','Irene','Joseph','Janet','Kelvin','Joy','Leonard','Lydia'])[n],
  (ARRAY['Nabukeera','Nakato','Wekesa','Nansubwa','Okello','Kasozi','Mukisa','Namutebi','Kaguta','Nakis','Wasswa','Luwang','Akello','Oboth','Laker','Amuge','Kagaba','Nabukeera','Musinguzi','Kyagulanyi'])[n],
  CASE WHEN n <= 10 THEN 'M' ELSE 'F' END,
  DATE '2008-01-01' + (random() * 365 || ' days')::interval,
  'e0a3631b-1262-4ef4-9845-ab63b46c6934', -- S.6A
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S6A-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((900000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 20) AS n;

-- S.6B (20 students)
INSERT INTO students (first_name, last_name, gender, date_of_birth, class_id, school_id, student_number, parent_name, parent_phone, status)
SELECT 
  (ARRAY['Arnold','Brenda','Collins','Cynthia','David','Deborah','Edward','Evelyn','Felix','Faith','George','Gloria','Harrison','Hope','Isaac','Ivy','James','Jane','Kelvin','Keziah'])[n],
  (ARRAY['Nassimbwa','Bugembe','Wanyana','Katende','Nankinga','Ssentamu','Namwaya','Kafeero','Nabulime','Mutesi','Wekunda','Ssebugwawo','Kagoda','Mubiru','Nabukeera','Semakula','Nyegenye','Mukisa','Nantongo','Katooke'])[n],
  CASE WHEN n <= 10 THEN 'M' ELSE 'F' END,
  DATE '2008-01-01' + (random() * 365 || ' days')::interval,
  '0eb91714-def9-4f1f-a019-1ba5b3adfaf8', -- S.6B
  '70ee855b-22f1-4b19-b71f-41882b17f260',
  'S6B-' || LPAD(n::text, 3, '0'),
  'Parent ' || n,
  '0778' || LPAD((000000 + n)::text, 7, '0'),
  'active'
FROM generate_series(1, 20) AS n;