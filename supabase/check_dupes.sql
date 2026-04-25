-- Check current duplicates
SELECT school_id, name, academic_year, COUNT(*) as dupes 
FROM public.classes 
GROUP BY school_id, name, academic_year 
HAVING COUNT(*) > 1
LIMIT 20;