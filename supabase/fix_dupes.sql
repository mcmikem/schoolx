-- Delete duplicate classes, keep first (lowest id)
DELETE FROM public.classes c1
WHERE EXISTS (
  SELECT 1 FROM public.classes c2 
  WHERE c2.school_id = c1.school_id 
    AND c2.name = c1.name 
    AND c2.academic_year = c1.academic_year
    AND c2.id < c1.id
);